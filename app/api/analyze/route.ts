import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { guardUsage, incrementUsage } from "@/lib/billing";
import { DEFAULT_PROJECT_ID } from "@/lib/constants";
import { DEMO_MODE, DEMO_ISSUES_PATH, STRICT_TWO_ISSUES } from "@/lib/env";
import type { AnalyzeResponse, HeatmapPoint, Issue } from "@/lib/issueSchema";
import { rankIssues, getTopIssues } from "@/lib/scoring";
import { parseSession, type ParsedSession } from "@/lib/sessionParser";
import { analyzeWithAiRadiologist, correlateSessions } from "@/lib/agents/aiRadiologistAgent";
import { validateIssue } from "@/lib/agents/qualitySentinelAgent";
import { getModelForAgent } from "@/lib/modelRouter";

interface SessionEvent {
  eventType?: string;
  elementId?: string;
  x?: number;
  y?: number;
  result?: string;
  scrollY?: number;
}

interface SessionData {
  userContext?: {
    viewport?: {
      width?: number;
      height?: number;
    };
  };
  events?: SessionEvent[];
}

interface AnalyzeRequest {
  projectId?: string;
  videoUrl?: string;
  sessionData?: SessionData;
}

function deriveHeatmapPoints(issue: Issue, sessionData?: SessionData): { points: HeatmapPoint[]; peakLabel: string } {
  const events = sessionData?.events ?? [];
  const width = sessionData?.userContext?.viewport?.width ?? 390;
  const height = sessionData?.userContext?.viewport?.height ?? 844;

  const withCoordinates = events.filter(
    (event) => typeof event.x === "number" && typeof event.y === "number"
  ) as Array<Required<Pick<SessionEvent, "x" | "y">> & SessionEvent>;

  const relevantClicks =
    issue.type === "dead_click"
      ? withCoordinates.filter(
          (event) =>
            event.eventType === "click" &&
            (event.result === "no_action" || event.elementId?.toLowerCase().includes("pricing"))
        )
      : withCoordinates.filter((event) => event.eventType === "click");

  if (relevantClicks.length > 0) {
    const bucket = new Map<string, { x: number; y: number; count: number }>();

    for (const event of relevantClicks) {
      const bx = Math.round(event.x / 20) * 20;
      const by = Math.round(event.y / 20) * 20;
      const key = `${bx}_${by}`;
      const current = bucket.get(key) ?? { x: bx, y: by, count: 0 };
      current.count += 1;
      bucket.set(key, current);
    }

    const clusters = [...bucket.values()].sort((a, b) => b.count - a.count).slice(0, 3);
    const maxCount = Math.max(...clusters.map((cluster) => cluster.count), 1);

    const points = clusters.map((cluster) => ({
      leftPct: Number(Math.min(98, Math.max(2, (cluster.x / width) * 100)).toFixed(1)),
      topPct: Number(Math.min(94, Math.max(6, (cluster.y / height) * 100)).toFixed(1)),
      intensity: Number(Math.min(1, cluster.count / maxCount).toFixed(2)),
    }));

    const peakLabel = issue.type === "dead_click" ? `Peak: ${maxCount} taps` : "Peak: CTA miss";
    return { points, peakLabel };
  }

  if (issue.type === "mobile_hidden_cta") {
    const points = [
      { leftPct: 78, topPct: 82, intensity: 0.92 },
      { leftPct: 74, topPct: 78, intensity: 0.7 },
      { leftPct: 70, topPct: 75, intensity: 0.52 },
    ];
    return { points, peakLabel: "Peak: CTA miss" };
  }

  const points = [
    { leftPct: 55, topPct: 38, intensity: 0.95 },
    { leftPct: 57, topPct: 42, intensity: 0.8 },
    { leftPct: 53, topPct: 40, intensity: 0.68 },
  ];
  return { points, peakLabel: "Peak: 7 taps" };
}

function enrichIssuesWithHeatmap(issues: Issue[], sessionData?: SessionData): Issue[] {
  return issues.map((issue) => {
    const { points, peakLabel } = deriveHeatmapPoints(issue, sessionData);
    return {
      ...issue,
      heatmapPoints: points,
      peakLabel,
    };
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;
  const projectId = body.projectId ?? DEFAULT_PROJECT_ID;
  const usageGate = await guardUsage(projectId, "analyze");

  if (!usageGate.allowed) {
    return NextResponse.json(
      {
        error: "Monthly analyze limit reached for this plan.",
        plan: usageGate.plan,
        limit: usageGate.limit,
        used: usageGate.used,
      },
      { status: 402 }
    );
  }

  let parsedIssues: Issue[] = [];
  let correlationData: {
    occurrenceRate?: number;
    sessionCount?: number;
  } = {};

  if (DEMO_MODE) {
    const raw = await readFile(DEMO_ISSUES_PATH, "utf-8");
    parsedIssues = JSON.parse(raw) as Issue[];
  } else {
    // Use the evolved AI Radiologist Agent with multi-format session parsing
    const sessionData: ParsedSession = body.sessionData
      ? parseSession(body.sessionData, "generic")
      : {
          sessionId: randomUUID(),
          source: "api",
          timestamp: new Date().toISOString(),
          viewport: { width: 1920, height: 1080, deviceType: "desktop" },
          frames: [],
          clicks: [],
          scrolls: [],
          forms: [],
          errors: [],
          metadata: { duration: 0, pageCount: 0 },
        };

    // Check if we have API keys configured
    if (!DEMO_MODE && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "API keys not configured",
          message: "Please add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to your environment, or enable demo mode by setting DEMO_MODE=true",
          demoModeHint: "Create .env.local with: DEMO_MODE=true",
          supportedProviders: [
            "OPENAI_API_KEY (for GPT-4o)",
            "ANTHROPIC_API_KEY (for Claude)",
            "GEMINI_API_KEY (for Gemini 2.5 Pro)"
          ]
        },
        { status: 401 }
      );
    }

    const visionModel = getModelForAgent("vision", usageGate.plan);
    const analysisResult = await analyzeWithAiRadiologist(
      {
        frames: sessionData.frames,
        clicks: sessionData.clicks,
        viewport: sessionData.viewport,
        sessionMetadata: body.sessionData as Record<string, unknown> | undefined,
      },
      { enableHeatmap: true, enableCrossSession: true }
    );

    // Add correlation data from cross-session analysis (if available)
    if (analysisResult.correlation) {
      correlationData = analysisResult.correlation;
    }

    // Add heatmap points from AI Radiologist
    parsedIssues = analysisResult.issues.map((issue) => ({
      ...issue,
      heatmapPoints: analysisResult.heatmap,
      // Add cross-session correlation data
      sessionCount: correlationData.sessionCount,
      occurrenceRate: correlationData.occurrenceRate,
    }));

    // Run quality validation on detected issues
    const validatedIssues: Issue[] = [];
    for (const issue of parsedIssues) {
      const validation = await validateIssue(issue);
      if (validation.valid) {
        validatedIssues.push(issue);
      }
    }
    parsedIssues = validatedIssues;
  }

  const enriched = enrichIssuesWithHeatmap(parsedIssues, body.sessionData);

  // Use ML-enhanced ranking with top N selection
  const maxIssues = STRICT_TWO_ISSUES ? 2 : 3;
  const topIssues = getTopIssues(enriched, maxIssues);

  const response: AnalyzeResponse & {
    projectId: string;
    correlation?: { occurrenceRate?: number; sessionCount?: number };
  } = {
    jobId: randomUUID(),
    projectId,
    issues: topIssues,
    correlation: correlationData.sessionCount ? correlationData : undefined,
  };

  await incrementUsage(projectId, "analyze");
  return NextResponse.json(response, { status: 200 });
}
