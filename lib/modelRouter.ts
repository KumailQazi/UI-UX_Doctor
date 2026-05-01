import "server-only";
import type { Issue, AgentPerformance } from "./issueSchema";
import type { PlanCode } from "./pricingConfig";
import { calculateAgentPerformance } from "./telemetry";

export type AgentType =
  | "vision"
  | "fix"
  | "preference"
  | "quality"
  | "meta"
  | "narrative"
  | "integration";

// Model tier definitions
const MODEL_TIERS = {
  low: "gpt-4o-mini",
  medium: "gpt-4o",
  high: "claude-3-5-sonnet-20240620",
  max: "claude-opus-4",
} as const;

// Default thresholds
const FIX_ESCALATION_CONFIDENCE_THRESHOLD = 0.75;
const ACCEPTANCE_RATE_ESCALATION_THRESHOLD = 0.75;
const ERROR_RATE_ESCALATION_THRESHOLD = 0.05;

type RoutedIssue = Pick<Issue, "severity" | "confidence">;

/**
 * Check if fix generation should be escalated based on issue severity/confidence
 */
function shouldEscalateFix(issue?: RoutedIssue): boolean {
  if (!issue) {
    return false;
  }

  return (
    issue.severity === "high" ||
    issue.confidence < FIX_ESCALATION_CONFIDENCE_THRESHOLD
  );
}

/**
 * Check if agent should be escalated based on performance metrics
 */
export function shouldEscalateAgent(agentPerf?: AgentPerformance): boolean {
  if (!agentPerf) {
    return false;
  }

  return (
    agentPerf.acceptanceRate < ACCEPTANCE_RATE_ESCALATION_THRESHOLD ||
    agentPerf.errorRate > ERROR_RATE_ESCALATION_THRESHOLD
  );
}

/**
 * Get the best model for an agent type based on plan, issue, and performance
 */
export function getModelForAgent(
  agent: AgentType,
  plan: PlanCode = "free",
  issue?: RoutedIssue,
  agentPerf?: AgentPerformance
): string {
  // Performance-based escalation check (Lead Surgeon pattern)
  const needsEscalation = shouldEscalateAgent(agentPerf);

  switch (agent) {
    case "vision":
      // AI Radiologist: Use high-quality vision model for paid plans
      return plan === "free" || needsEscalation
        ? MODEL_TIERS.medium
        : MODEL_TIERS.low;

    case "fix":
      // UI Surgeon: Escalate based on issue severity or agent performance
      if (plan === "free") {
        return MODEL_TIERS.low;
      }
      if (shouldEscalateFix(issue) || needsEscalation) {
        return MODEL_TIERS.high;
      }
      return MODEL_TIERS.low;

    case "preference":
      // Integration Engineer: Reliable low-latency model
      return MODEL_TIERS.low;

    case "quality":
      // Quality Sentinel: Rule-based + edge case model
      return MODEL_TIERS.low;

    case "meta":
      // Meta-Learner: High-quality for prompt engineering
      return plan === "enterprise" || needsEscalation
        ? MODEL_TIERS.max
        : MODEL_TIERS.high;

    case "narrative":
      // Narrative Engine: Cost-effective for dashboard generation
      return MODEL_TIERS.low;

    case "integration":
      // Integration Engineer: Reliable for API calls
      return MODEL_TIERS.low;

    default:
      return MODEL_TIERS.low;
  }
}

/**
 * Async version that fetches agent performance from telemetry
 */
export async function getModelForAgentAsync(
  agent: AgentType,
  agentId: string,
  plan: PlanCode = "free",
  issue?: RoutedIssue
): Promise<string> {
  const agentPerf = await calculateAgentPerformance(agentId, 7);
  return getModelForAgent(agent, plan, issue, agentPerf);
}

/**
 * Get model tier description for logging/debugging
 */
export function getModelTierDescription(model: string): string {
  for (const [tier, modelName] of Object.entries(MODEL_TIERS)) {
    if (modelName === model) {
      return tier;
    }
  }
  return "unknown";
}
