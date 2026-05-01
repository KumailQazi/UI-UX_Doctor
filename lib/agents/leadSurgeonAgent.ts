import "server-only";
import { getAgentRole } from "../agentRoles";
import type { AgentPerformance } from "../issueSchema";
import {
  calculateAgentPerformance,
  getAllAgentPerformance,
} from "../telemetry";
import { recordTelemetry } from "../telemetry";

/**
 * Lead Surgeon Agent (Evolved)
 * Codename: lead-surgeon
 * Model: Claude Sonnet 4 / GPT-4o
 * Personality: Ruthless prioritizer. Speaks in business impact.
 *
 * New Capabilities:
 * - Maintains living ROADMAP.md based on agent performance
 * - Allocates credits between agents based on success rates
 * - Escalates models when performance drops
 * - Runs 4-check framework
 */

export const LEAD_SURGEON_VERSION = "2.0.0";

/**
 * Get Lead Surgeon system context
 */
export function getLeadSurgeonSystemContext(): string {
  return getAgentRole("lead-surgeon").systemContext;
}

/**
 * Agent credit allocation based on performance
 */
interface AgentCredits {
  agentId: string;
  credits: number; // 0-100
  reasoning: string;
}

/**
 * Check if model escalation is needed
 */
export function shouldEscalateModel(agent: AgentPerformance): boolean {
  return agent.acceptanceRate < 0.75 || agent.errorRate > 0.05;
}

/**
 * Calculate credit allocation for agents
 */
export function calculateCreditAllocation(
  performances: AgentPerformance[]
): AgentCredits[] {
  const totalPerformance = performances.reduce(
    (sum, p) => sum + p.acceptanceRate * (1 - p.errorRate),
    0
  );

  return performances.map((p) => {
    const performance = p.acceptanceRate * (1 - p.errorRate);
    const baseCredit = (performance / (totalPerformance || 1)) * 100;

    // Penalize high latency
    const latencyPenalty = p.avgLatencyMs > 5000 ? 10 : 0;

    // Boost agents with high task completion
    const completionBoost = p.tasksCompleted > 50 ? 5 : 0;

    const credits = Math.max(10, Math.min(100, baseCredit - latencyPenalty + completionBoost));

    let reasoning = `Performance: ${(p.acceptanceRate * 100).toFixed(1)}% acceptance, ${(p.errorRate * 100).toFixed(1)}% error rate`;
    if (latencyPenalty > 0) reasoning += `, -${latencyPenalty}pts for high latency`;
    if (completionBoost > 0) reasoning += `, +${completionBoost}pts for volume`;

    return {
      agentId: p.agentId,
      credits: Math.round(credits),
      reasoning,
    };
  });
}

/**
 * Prioritization check result
 */
export interface PrioritizationResult {
  shouldBuild: boolean;
  priority: "critical" | "high" | "medium" | "low";
  reasoning: string;
  checks: {
    userImpact: boolean;
    feasibility: boolean;
    strategicAlignment: boolean;
    resourceAvailability: boolean;
  };
}

/**
 * Run the 4-check framework for prioritization
 */
export function runFourCheckFramework(params: {
  userImpact: boolean;
  feasibility: boolean;
  strategicAlignment: boolean;
  resourceAvailability: boolean;
  businessValue?: number; // 0-100
  implementationComplexity?: number; // 0-100
}): PrioritizationResult {
  const checks = {
    userImpact: params.userImpact,
    feasibility: params.feasibility,
    strategicAlignment: params.strategicAlignment,
    resourceAvailability: params.resourceAvailability,
  };

  const passCount = Object.values(checks).filter(Boolean).length;

  let shouldBuild: boolean;
  let priority: PrioritizationResult["priority"];
  let reasoning: string;

  if (passCount === 4) {
    shouldBuild = true;
    priority = "critical";
    reasoning = "All 4 checks passed. This is a must-build feature with high confidence.";
  } else if (passCount === 3) {
    shouldBuild = true;
    priority = "high";
    const failed = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    reasoning = `3/4 checks passed. Proceed with caution - failed check: ${failed[0]}. Mitigate risk before full rollout.`;
  } else if (passCount === 2) {
    shouldBuild = !!(params.businessValue && params.businessValue > 70);
    priority = "medium";
    reasoning = shouldBuild
      ? "2/4 checks passed, but high business value justifies investment. Consider MVP approach."
      : "2/4 checks passed with moderate business value. Revisit when more checks can be satisfied.";
  } else {
    shouldBuild = false;
    priority = "low";
    reasoning = `Only ${passCount}/4 checks passed. This initiative needs more validation before resources are allocated.`;
  }

  return { shouldBuild, priority, reasoning, checks };
}

/**
 * Roadmap item
 */
interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  priority: PrioritizationResult["priority"];
  status: "planned" | "in_progress" | "completed" | "deferred";
  targetDate?: string;
  agentOwner?: string;
  successCriteria: string[];
}

/**
 * Generate living roadmap based on agent performance
 */
export async function generateRoadmap(
  plannedItems: RoadmapItem[]
): Promise<{
  roadmap: RoadmapItem[];
  narrative: string;
  agentAllocations: AgentCredits[];
}> {
  const performances = await getAllAgentPerformance(7);
  const allocations = calculateCreditAllocation(performances);

  // Sort planned items by priority
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const sortedItems = [...plannedItems].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // Assign top-credit agents to high-priority items
  const highCreditAgents = allocations
    .filter((a) => a.credits > 50)
    .sort((a, b) => b.credits - a.credits);

  const roadmap = sortedItems.map((item, idx) => {
    if (item.status === "planned" && highCreditAgents[idx]) {
      return {
        ...item,
        agentOwner: highCreditAgents[idx].agentId,
      };
    }
    return item;
  });

  // Generate narrative
  const inProgress = roadmap.filter((i) => i.status === "in_progress").length;
  const critical = roadmap.filter((i) => i.priority === "critical").length;
  const topAgent = highCreditAgents[0];

  const narrative = `Roadmap has ${roadmap.length} items (${critical} critical, ${inProgress} in progress). ${topAgent ? `Top performing agent ${topAgent.agentId} (${topAgent.credits} credits) allocated to highest priority work.` : ""} Underperforming agents flagged for model escalation.`;

  return { roadmap, narrative, agentAllocations: allocations };
}

/**
 * Check agent health and recommend actions
 */
export async function checkAgentHealth(): Promise<{
  healthy: AgentPerformance[];
  needsAttention: Array<AgentPerformance & { action: string }>;
  escalations: Array<AgentPerformance & { recommendedModel: string }>;
}> {
  const performances = await getAllAgentPerformance(7);

  const healthy: AgentPerformance[] = [];
  const needsAttention: Array<AgentPerformance & { action: string }> = [];
  const escalations: Array<AgentPerformance & { recommendedModel: string }> = [];

  for (const perf of performances) {
    if (perf.acceptanceRate >= 0.85 && perf.errorRate < 0.02) {
      healthy.push(perf);
    } else if (shouldEscalateModel(perf)) {
      escalations.push({
        ...perf,
        recommendedModel:
          perf.agentId === "ui-surgeon"
            ? "claude-opus-4"
            : perf.agentId === "ai-radiologist"
              ? "gpt-4o"
              : "gpt-4o-mini",
      });
    } else {
      needsAttention.push({
        ...perf,
        action:
          perf.acceptanceRate < 0.8
            ? "Review prompt quality with Meta-Learner"
            : perf.errorRate > 0.03
              ? "Add validation gates in Quality Sentinel"
              : "Optimize latency",
      });
    }
  }

  // Record telemetry
  await recordTelemetry({
    agentId: "lead-surgeon",
    taskType: "validate",
    projectId: "health-check",
    inputHash: `${performances.length}`,
    outputHash: `${healthy.length}-${needsAttention.length}-${escalations.length}`,
    latencyMs: 0,
    promptVersion: LEAD_SURGEON_VERSION,
    modelUsed: "rule-based",
    confidence: healthy.length / (performances.length || 1),
  });

  return { healthy, needsAttention, escalations };
}

/**
 * Main orchestration entry point
 */
export async function orchestrateAgents(
  task: {
    type: "analyze" | "generate_fix" | "feedback" | "prioritize";
    projectId: string;
    priority?: boolean;
  },
  options?: {
    preferredAgent?: string;
    bypassChecks?: boolean;
  }
): Promise<{
  assignedAgent: string;
  model: string;
  checks?: PrioritizationResult;
  estimatedLatency: number;
}> {
  const startTime = Date.now();

  // Run prioritization check
  let checks: PrioritizationResult | undefined;
  if (!options?.bypassChecks && task.priority) {
    checks = runFourCheckFramework({
      userImpact: true,
      feasibility: true,
      strategicAlignment: true,
      resourceAvailability: true,
    });
  }

  // Determine best agent
  const performances = await getAllAgentPerformance(7);
  const agentForTask: Record<string, string> = {
    analyze: "ai-radiologist",
    generate_fix: "ui-surgeon",
    feedback: "surgical-assistant",
    prioritize: "lead-surgeon",
  };

  const targetAgentId = options?.preferredAgent ?? agentForTask[task.type];
  const agentPerf = performances.find((p) => p.agentId === targetAgentId);

  // Determine model based on performance
  let model = "gpt-4o-mini";
  if (agentPerf) {
    if (shouldEscalateModel(agentPerf)) {
      model =
        targetAgentId === "ui-surgeon"
          ? "claude-opus-4"
          : targetAgentId === "ai-radiologist"
            ? "gpt-4o"
            : "gpt-4o-mini";
    } else if (agentPerf.acceptanceRate > 0.9) {
      model = "gpt-4o-mini"; // High-performing agents can use cheaper models
    } else {
      model = "gpt-4o";
    }
  }

  // Estimate latency based on agent history
  const estimatedLatency = agentPerf?.avgLatencyMs ?? 2000;

  await recordTelemetry({
    agentId: "lead-surgeon",
    taskType: "validate",
    projectId: task.projectId,
    inputHash: `${task.type}-${task.projectId}`,
    outputHash: targetAgentId,
    latencyMs: Date.now() - startTime,
    promptVersion: LEAD_SURGEON_VERSION,
    modelUsed: model,
    confidence: agentPerf?.acceptanceRate ?? 0.5,
  });

  return {
    assignedAgent: targetAgentId,
    model,
    checks,
    estimatedLatency,
  };
}

/**
 * Legacy support for shouldBuildFeature
 */
export function shouldBuildFeature(answerCount: number): boolean {
  return answerCount >= 3;
}
