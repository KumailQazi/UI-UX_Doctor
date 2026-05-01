import "server-only";
import { getAgentRole } from "../agentRoles";
import {
  queryTelemetry,
  calculateAgentPerformance,
  getAllAgentPerformance,
} from "../telemetry";
import type { Issue, AgentPerformance } from "../issueSchema";

/**
 * Narrative Engine Agent
 * Codename: narrative-engine
 * Model: Claude Sonnet / GPT-4o-mini
 * Personality: Data storyteller. Turns raw metrics into board-ready insights.
 *
 * Responsibilities:
 * - Friction Cost Calculator: estimate revenue impact of issues
 * - Trend Forecasting: predict backlog clearance dates
 * - Team Velocity: track acceptance rate per team member
 * - Competitive Benchmark: compare to industry standards
 * - Generate dashboard widgets with actionable insights
 * - Report agent improvement metrics from Meta-Learner
 */

export const NARRATIVE_ENGINE_VERSION = "1.0.0";

// Industry benchmarks (simplified for MVP)
const INDUSTRY_BENCHMARKS = {
  mobileCTAVisibility: 0.77, // 77% of SaaS have visible mobile CTAs
  avgFormCompletionRate: 0.62,
  avgDeadClickRate: 0.15,
  avgConversionRate: 0.034,
};

// Assumed revenue impact multipliers (would be configurable per project)
const REVENUE_MULTIPLIERS = {
  high_severity_daily_cost: 4200, // $4,200 per high-severity issue per day
  medium_severity_daily_cost: 1200,
  low_severity_daily_cost: 300,
  conversion_per_visitor: 50, // $50 average conversion value
};

/**
 * Get Narrative Engine system context
 */
export function getNarrativeEngineSystemContext(): string {
  return getAgentRole("narrative-engine").systemContext;
}

/**
 * Calculate friction cost (revenue impact) of issues
 */
export function calculateFrictionCost(
  issues: Issue[],
  daysActive: number = 30,
  revenueMultiplier?: Partial<typeof REVENUE_MULTIPLIERS>
): {
  totalCost: number;
  bySeverity: Record<string, number>;
  byIssueType: Record<string, number>;
  narrative: string;
} {
  const multipliers = { ...REVENUE_MULTIPLIERS, ...revenueMultiplier };

  let totalCost = 0;
  const bySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const byIssueType: Record<string, number> = {};

  for (const issue of issues) {
    const dailyCost =
      issue.severity === "high"
        ? multipliers.high_severity_daily_cost
        : issue.severity === "medium"
          ? multipliers.medium_severity_daily_cost
          : multipliers.low_severity_daily_cost;

    // Adjust by confidence and occurrence rate
    const adjustedCost =
      dailyCost * daysActive * issue.confidence * (issue.occurrenceRate ?? 1);

    totalCost += adjustedCost;
    bySeverity[issue.severity] += adjustedCost;
    byIssueType[issue.type] = (byIssueType[issue.type] ?? 0) + adjustedCost;
  }

  // Generate narrative
  const severityNarrative =
    bySeverity.high > bySeverity.medium && bySeverity.high > bySeverity.low
      ? "High-severity issues are your biggest cost driver"
      : bySeverity.medium > bySeverity.low
        ? "Medium-severity issues collectively cost more than high-severity ones"
        : "Low-severity issues are widespread but individually low-cost";

  const narrative = `These ${issues.length} issues have cost approximately $${totalCost.toLocaleString()} over ${daysActive} days. ${severityNarrative}. Focus on ${Object.entries(byIssueType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "high-severity issues"} for maximum ROI.`;

  return {
    totalCost: Math.round(totalCost),
    bySeverity,
    byIssueType,
    narrative,
  };
}

/**
 * Forecast when backlog will be cleared
 */
export async function forecastBacklogClearance(
  projectId: string,
  openIssues: number,
  teamCapacity?: number // Issues per week
): Promise<{
  predictedClearanceDate: string;
  confidence: number;
  narrative: string;
}> {
  // Default capacity if not provided
  const capacity = teamCapacity ?? 5; // Assume 5 issues per week

  // Query historical velocity from telemetry
  const completedEvents = await queryTelemetry({
    projectId,
    taskType: "feedback",
    userFeedback: "accepted",
    since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    limit: 100,
  });

  // Calculate actual velocity
  const weeksAnalyzed = 12; // 90 days
  const actualVelocity = completedEvents.length / weeksAnalyzed;
  const effectiveVelocity = Math.max(capacity, actualVelocity);

  const weeksToClear = openIssues / effectiveVelocity;
  const clearanceDate = new Date();
  clearanceDate.setDate(clearanceDate.getDate() + weeksToClear * 7);

  const confidence = Math.min(0.9, 0.5 + completedEvents.length / 50);

  const velocityNarrative =
    actualVelocity > capacity
      ? `Your team is performing above capacity (${actualVelocity.toFixed(1)} issues/week)`
      : `Team capacity is ${effectiveVelocity.toFixed(1)} issues per week`;

  const narrative = `${velocityNarrative}. At this rate, you'll clear the backlog of ${openIssues} issues by ${clearanceDate.toLocaleDateString()}. ${weeksToClear > 4 ? "Consider increasing capacity to meet quarterly goals." : "You're on track for rapid backlog clearance!"}`;

  return {
    predictedClearanceDate: clearanceDate.toISOString(),
    confidence,
    narrative,
  };
}

/**
 * Generate team velocity insights
 */
export async function generateTeamVelocityInsights(
  projectId: string,
  teamMembers?: string[]
): Promise<{
  overallAcceptanceRate: number;
  byTeamMember: Record<string, { acceptanceRate: number; fixesReviewed: number }>;
  narrative: string;
}> {
  const feedbackEvents = await queryTelemetry({
    projectId,
    taskType: "feedback",
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const withFeedback = feedbackEvents.filter((e) => e.userFeedback);
  const accepted = withFeedback.filter((e) => e.userFeedback === "accepted");
  const overallAcceptanceRate =
    withFeedback.length > 0 ? accepted.length / withFeedback.length : 0;

  // Per team member analysis (if team members are tracked)
  const byTeamMember: Record<
    string,
    { acceptanceRate: number; fixesReviewed: number }
  > = {};

  if (teamMembers) {
    for (const member of teamMembers) {
      // In a real implementation, events would have team member attribution
      // For MVP, we use aggregate data
      byTeamMember[member] = {
        acceptanceRate: overallAcceptanceRate,
        fixesReviewed: Math.floor(withFeedback.length / teamMembers.length),
      };
    }
  }

  const rate = (overallAcceptanceRate * 100).toFixed(1);
  const narrative = `Team acceptance rate is ${rate}% over the last 30 days. ${overallAcceptanceRate > 0.85 ? "Excellent performance!" : overallAcceptanceRate > 0.7 ? "Good performance with room for improvement." : "Consider reviewing fix quality with the team."}`;

  return {
    overallAcceptanceRate,
    byTeamMember,
    narrative,
  };
}

/**
 * Generate competitive benchmark insights
 */
export function generateBenchmarkInsights(
  issues: Issue[],
  viewportInfo: { mobile: boolean; tablet: boolean; desktop: boolean }
): {
  mobileCTARanking: "top" | "middle" | "bottom";
  percentile: number;
  narrative: string;
  recommendations: string[];
} {
  const mobileCTAIssues = issues.filter((i) => i.type === "mobile_hidden_cta");
  const hasMobileCTAIssue = mobileCTAIssues.length > 0;

  let mobileCTARanking: "top" | "middle" | "bottom" = "middle";
  let percentile = 50;

  if (viewportInfo.mobile && !hasMobileCTAIssue) {
    mobileCTARanking = "top";
    percentile = 77;
  } else if (hasMobileCTAIssue) {
    mobileCTARanking = "bottom";
    percentile = 23;
  }

  const recommendations: string[] = [];
  if (hasMobileCTAIssue) {
    recommendations.push(
      "Your mobile CTA visibility is in the bottom 23% of SaaS checkout flows"
    );
    recommendations.push(
      "Implement sticky mobile CTAs to move to the top 50%"
    );
  }

  const otherIssueTypes = new Set(issues.map((i) => i.type));
  if (otherIssueTypes.has("dead_click")) {
    recommendations.push(
      "Dead click rate is higher than industry average (15%)"
    );
  }

  const narrative = hasMobileCTAIssue
    ? `Your mobile CTA visibility is in the bottom ${100 - percentile}% of SaaS products. This is a critical conversion blocker.`
    : `Your mobile UX is performing above the ${percentile}th percentile. Keep it up!`;

  return {
    mobileCTARanking,
    percentile,
    narrative,
    recommendations,
  };
}

/**
 * Generate dashboard widgets data
 */
export async function generateDashboardWidgets(
  projectId: string,
  issues: Issue[]
): Promise<
  Array<{
    widgetId: string;
    type: "metric" | "chart" | "narrative" | "alert";
    title: string;
    data: unknown;
    priority: "high" | "medium" | "low";
  }>
> {
  const widgets: Array<{
    widgetId: string;
    type: "metric" | "chart" | "narrative" | "alert";
    title: string;
    data: unknown;
    priority: "high" | "medium" | "low";
  }> = [];

  // 1. Friction Cost Widget
  const frictionCost = calculateFrictionCost(issues);
  widgets.push({
    widgetId: "friction-cost",
    type: "metric",
    title: "Estimated Revenue Impact",
    data: {
      value: frictionCost.totalCost,
      format: "currency",
      subtitle: "Last 30 days",
      breakdown: frictionCost.bySeverity,
    },
    priority: "high",
  });

  // 2. Backlog Forecast Widget
  const forecast = await forecastBacklogClearance(projectId, issues.length);
  widgets.push({
    widgetId: "backlog-forecast",
    type: "narrative",
    title: "Backlog Clearance Forecast",
    data: {
      narrative: forecast.narrative,
      date: forecast.predictedClearanceDate,
      confidence: forecast.confidence,
    },
    priority: "medium",
  });

  // 3. Team Velocity Widget
  const velocity = await generateTeamVelocityInsights(projectId);
  widgets.push({
    widgetId: "team-velocity",
    type: "metric",
    title: "Team Acceptance Rate",
    data: {
      value: (velocity.overallAcceptanceRate * 100).toFixed(1),
      format: "percentage",
      subtitle: "Last 30 days",
      narrative: velocity.narrative,
    },
    priority: "medium",
  });

  // 4. Benchmark Widget
  const benchmark = generateBenchmarkInsights(issues, {
    mobile: true,
    tablet: false,
    desktop: true,
  });
  widgets.push({
    widgetId: "benchmark",
    type: "narrative",
    title: "Competitive Benchmark",
    data: {
      percentile: benchmark.percentile,
      narrative: benchmark.narrative,
      recommendations: benchmark.recommendations,
    },
    priority: benchmark.mobileCTARanking === "bottom" ? "high" : "low",
  });

  // 5. Agent Performance Widget
  const agentPerformance = await getAllAgentPerformance(7);
  widgets.push({
    widgetId: "agent-performance",
    type: "chart",
    title: "Agent Performance (7 days)",
    data: {
      chartType: "bar",
      labels: agentPerformance.map((a) => a.agentId),
      datasets: [
        {
          label: "Acceptance Rate",
          data: agentPerformance.map((a) => (a.acceptanceRate * 100).toFixed(1)),
        },
        {
          label: "Avg Latency (ms)",
          data: agentPerformance.map((a) => a.avgLatencyMs),
        },
      ],
    },
    priority: "low",
  });

  // 6. High Priority Alert Widget (if applicable)
  const highSeverityIssues = issues.filter((i) => i.severity === "high");
  if (highSeverityIssues.length > 0) {
    widgets.push({
      widgetId: "high-priority-alert",
      type: "alert",
      title: "High Severity Issues Detected",
      data: {
        count: highSeverityIssues.length,
        issues: highSeverityIssues.map((i) => ({
          id: i.issueId,
          type: i.type,
          summary: i.summary,
        })),
        action: "Review and prioritize fixes",
      },
      priority: "high",
    });
  }

  return widgets;
}

/**
 * Generate full dashboard report
 */
export async function generateDashboardReport(
  projectId: string,
  issues: Issue[],
  options?: {
    revenueMultiplier?: Partial<typeof REVENUE_MULTIPLIERS>;
    teamMembers?: string[];
    teamCapacity?: number;
  }
): Promise<{
  generatedAt: string;
  projectId: string;
  summary: {
    totalIssues: number;
    bySeverity: Record<string, number>;
    estimatedCost: number;
    topRecommendation: string;
  };
  widgets: Awaited<ReturnType<typeof generateDashboardWidgets>>;
  narrative: string;
}> {
  const widgets = await generateDashboardWidgets(projectId, issues);
  const frictionCost = calculateFrictionCost(
    issues,
    30,
    options?.revenueMultiplier
  );

  const bySeverity = issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get top recommendation
  const highPriorityWidget = widgets.find((w) => w.priority === "high");
  const topRecommendation =
    highPriorityWidget?.title ?? "Continue monitoring for new issues";

  // Generate overall narrative
  const narrative = `Your project has ${issues.length} active issues with an estimated monthly cost of $${frictionCost.totalCost.toLocaleString()}. ${frictionCost.narrative} Immediate action recommended: ${topRecommendation}.`;

  return {
    generatedAt: new Date().toISOString(),
    projectId,
    summary: {
      totalIssues: issues.length,
      bySeverity,
      estimatedCost: frictionCost.totalCost,
      topRecommendation,
    },
    widgets,
    narrative,
  };
}

/**
 * Report agent improvement metrics (called by Meta-Learner)
 */
export async function reportAgentImprovements(
  improvements: Array<{
    agentId: string;
    metric: string;
    oldValue: number;
    newValue: number;
    changePercent: number;
  }>
): Promise<{
  narrative: string;
  highlights: string[];
}> {
  const highlights = improvements.map((imp) => {
    const direction = imp.changePercent > 0 ? "improved" : "declined";
    return `${imp.agentId} ${imp.metric} ${direction} by ${Math.abs(imp.changePercent).toFixed(1)}%`;
  });

  const positiveChanges = improvements.filter((i) => i.changePercent > 0);
  const narrative =
    positiveChanges.length === improvements.length
      ? `All agents showed improvement this cycle. ${highlights.join("; ")}.`
      : `${positiveChanges.length} of ${improvements.length} metrics improved. ${highlights.join("; ")}.`;

  return { narrative, highlights };
}
