import "server-only";
import type { Issue } from "./issueSchema";
import type { PlanCode } from "./pricingConfig";

export type AgentType = "vision" | "fix" | "preference";

const LOW_COST_MODEL = "gpt-4o-mini";
const HIGH_QUALITY_VISION_MODEL = "gpt-4o";
const HIGH_QUALITY_FIX_MODEL = "claude-3-5-sonnet-20240620";
const FIX_ESCALATION_CONFIDENCE_THRESHOLD = 0.75;

type RoutedIssue = Pick<Issue, "severity" | "confidence">;

function shouldEscalateFix(issue?: RoutedIssue): boolean {
  if (!issue) {
    return false;
  }

  return issue.severity === "high" || issue.confidence < FIX_ESCALATION_CONFIDENCE_THRESHOLD;
}

export function getModelForAgent(
  agent: AgentType,
  plan: PlanCode = "free",
  issue?: RoutedIssue
): string {
  if (agent === "vision") {
    return plan === "free" ? LOW_COST_MODEL : HIGH_QUALITY_VISION_MODEL;
  }

  if (agent === "fix") {
    if (plan === "free") {
      return LOW_COST_MODEL;
    }

    return shouldEscalateFix(issue) ? HIGH_QUALITY_FIX_MODEL : LOW_COST_MODEL;
  }

  return LOW_COST_MODEL;
}
