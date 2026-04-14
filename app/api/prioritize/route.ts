import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/constants";
import { getLeadSurgeonSystemContext, shouldBuildFeature } from "@/lib/leadSurgeonAgent";

interface PrioritizeRequest {
  projectId?: string;
  featureName?: string;
  summary?: string;
  checks?: {
    demosIn30Seconds?: boolean;
    showsDefensibility?: boolean;
    hasVisibleBusinessImpact?: boolean;
    buildableInUnderOneHour?: boolean;
  };
}

interface ChecklistResult {
  key:
    | "demosIn30Seconds"
    | "showsDefensibility"
    | "hasVisibleBusinessImpact"
    | "buildableInUnderOneHour";
  question: string;
  passed: boolean;
}

interface PrioritizeResponse {
  projectId: string;
  agent: "lead-surgeon";
  featureName: string;
  summary?: string;
  decision: "BUILD" | "PARK";
  yesCount: number;
  threshold: number;
  checklist: ChecklistResult[];
  rationale: string;
  roleContext: string;
}

const THRESHOLD = 3;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PrioritizeRequest;
  const projectId = body.projectId ?? DEFAULT_PROJECT_ID;
  const featureName = body.featureName?.trim() || "Untitled feature";

  const checks = body.checks ?? {};
  const checklist: ChecklistResult[] = [
    {
      key: "demosIn30Seconds",
      question: "Does it demo in < 30 seconds?",
      passed: Boolean(checks.demosIn30Seconds),
    },
    {
      key: "showsDefensibility",
      question: "Does it show defensibility (data moat, learning)?",
      passed: Boolean(checks.showsDefensibility),
    },
    {
      key: "hasVisibleBusinessImpact",
      question: "Does it have visible business impact ($$ metric)?",
      passed: Boolean(checks.hasVisibleBusinessImpact),
    },
    {
      key: "buildableInUnderOneHour",
      question: "Can it be built in < 1 hour?",
      passed: Boolean(checks.buildableInUnderOneHour),
    },
  ];

  const yesCount = checklist.filter((item) => item.passed).length;
  const decision: "BUILD" | "PARK" = shouldBuildFeature(yesCount) ? "BUILD" : "PARK";
  const roleContext = getLeadSurgeonSystemContext();

  const response: PrioritizeResponse = {
    projectId,
    agent: "lead-surgeon",
    featureName,
    summary: body.summary,
    decision,
    yesCount,
    threshold: THRESHOLD,
    checklist,
    rationale:
      decision === "BUILD"
        ? `Feature passed ${yesCount}/4 checks (threshold ${THRESHOLD}). Prioritize for near-term implementation.`
        : `Feature passed ${yesCount}/4 checks (threshold ${THRESHOLD}). Park for later to preserve scope discipline.`,
    roleContext,
  };

  return NextResponse.json(response, { status: 200 });
}
