import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { guardUsage, incrementUsage } from "@/lib/billing";
import type { AnalyzeResponse, HeatmapPoint, Issue } from "@/lib/issueSchema";
import { rankIssues } from "@/lib/scoring";

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
  const projectId = body.projectId ?? "demo-project";
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

  const demoIssuesPath = path.join(process.cwd(), "data", "demo-issues.json");
  const raw = await readFile(demoIssuesPath, "utf-8");
  const parsedIssues = JSON.parse(raw) as Issue[];

  const enriched = enrichIssuesWithHeatmap(parsedIssues, body.sessionData);
  const ranked = rankIssues(enriched);

  const strictTwoIssues = process.env.STRICT_TWO_ISSUES === "true";
  const issues = strictTwoIssues ? ranked.slice(0, 2) : ranked.slice(0, 3);

  const response: AnalyzeResponse & { projectId: string } = {
    jobId: randomUUID(),
    projectId,
    issues,
  };

  await incrementUsage(projectId, "analyze");
  return NextResponse.json(response, { status: 200 });
}
