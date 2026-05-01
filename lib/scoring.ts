import type { Issue, Severity } from "@/lib/issueSchema";

// Base severity weights
const severityScore: Record<Severity, number> = {
  high: 0.95,
  medium: 0.75,
  low: 0.55,
};

// Issue type impact multipliers (business impact)
const typeImpactMultiplier: Record<string, number> = {
  dead_click: 1.2,
  mobile_hidden_cta: 1.3,
  form_field_confusion: 1.0,
  rage_click_pattern: 1.25,
  error_message_confusion: 1.15,
  navigation_loop: 0.9,
  carousel_skip_rate: 0.7,
  scroll_stop: 0.6,
  hover_hesitation: 0.5,
};

// Confidence decay based on issue age (simulated for cross-session data)
function calculateConfidenceDecay(
  confidence: number,
  occurrenceRate?: number,
  sessionCount?: number
): number {
  // Higher occurrence across sessions increases effective confidence
  if (occurrenceRate && sessionCount && sessionCount > 1) {
    const crossSessionBoost = Math.min(0.1, occurrenceRate * 0.1);
    return Math.min(1, confidence + crossSessionBoost);
  }
  return confidence;
}

/**
 * Calculate ML-enhanced issue score
 * Combines severity, confidence, type impact, and cross-session correlation
 */
export function scoreIssue(issue: Issue): number {
  const base = severityScore[issue.severity] ?? 0.5;
  const adjustedConfidence = calculateConfidenceDecay(
    issue.confidence,
    issue.occurrenceRate,
    issue.sessionCount
  );
  const typeMultiplier = typeImpactMultiplier[issue.type] ?? 1.0;

  // Weighted formula:
  // - Severity: 50% (business priority)
  // - Confidence: 25% (detection reliability)
  // - Type impact: 15% (known business impact)
  // - Cross-session: 10% (pattern validation)

  const crossSessionWeight =
    issue.sessionCount && issue.sessionCount > 1
      ? Math.min(0.1, issue.sessionCount * 0.02)
      : 0;

  const score =
    base * 0.5 +
    adjustedConfidence * 0.25 * typeMultiplier +
    base * typeMultiplier * 0.15 +
    crossSessionWeight;

  return Number(Math.min(1, score).toFixed(4));
}

/**
 * Rank issues by ML-enhanced score
 */
export function rankIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => scoreIssue(b) - scoreIssue(a));
}

/**
 * Get top N issues by score
 */
export function getTopIssues(issues: Issue[], n: number = 3): Issue[] {
  return rankIssues(issues).slice(0, n);
}

/**
 * Calculate issue priority tier
 */
export function getPriorityTier(issue: Issue): "critical" | "high" | "medium" | "low" {
  const score = scoreIssue(issue);

  if (score >= 0.9) return "critical";
  if (score >= 0.75) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

/**
 * Group issues by priority tier
 */
export function groupByPriority(
  issues: Issue[]
): Record<"critical" | "high" | "medium" | "low", Issue[]> {
  const groups: Record<"critical" | "high" | "medium" | "low", Issue[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const issue of issues) {
    const tier = getPriorityTier(issue);
    groups[tier].push(issue);
  }

  return groups;
}

/**
 * Calculate aggregate health score for a set of issues
 */
export function calculateHealthScore(issues: Issue[]): {
  overall: number;
  byCategory: Record<string, number>;
} {
  if (issues.length === 0) {
    return { overall: 100, byCategory: {} };
  }

  // Calculate weighted average (inverse of issue scores)
  const totalWeight = issues.reduce((sum, i) => scoreIssue(i), 0);
  const healthScore = Math.max(0, 100 - totalWeight * 10);

  // Group by issue type
  const byCategory: Record<string, number> = {};
  for (const issue of issues) {
    const score = scoreIssue(issue);
    byCategory[issue.type] = (byCategory[issue.type] ?? 0) + score;
  }

  // Normalize category scores
  for (const type of Object.keys(byCategory)) {
    byCategory[type] = Math.max(0, 100 - byCategory[type] * 10);
  }

  return {
    overall: Math.round(healthScore),
    byCategory,
  };
}

/**
 * Predict resolution impact score
 * Estimates how much fixing this issue would improve overall UX
 */
export function predictResolutionImpact(
  issue: Issue,
  allIssues: Issue[]
): number {
  const issueScore = scoreIssue(issue);

  // Check for related issues of same type
  const relatedIssues = allIssues.filter(
    (i) => i.type === issue.type && i.issueId !== issue.issueId
  );

  // If fixing one instance would fix multiple (shared root cause)
  if (relatedIssues.length > 0) {
    const relatedScore = relatedIssues.reduce((sum, i) => sum + scoreIssue(i), 0);
    return Math.min(1, issueScore + relatedScore * 0.3);
  }

  return issueScore;
}

/**
 * Recommend fix order based on impact and dependencies
 */
export function recommendFixOrder(
  issues: Issue[]
): Array<{
  issue: Issue;
  rank: number;
  impact: number;
  reasoning: string;
}> {
  const ranked = rankIssues(issues);

  return ranked.map((issue, idx) => {
    const impact = predictResolutionImpact(issue, issues);
    const tier = getPriorityTier(issue);

    let reasoning: string;
    if (tier === "critical") {
      reasoning = `Critical priority: ${issue.whyItMatters}`;
    } else if (issue.sessionCount && issue.sessionCount > 5) {
      reasoning = `High occurrence (${issue.sessionCount} sessions): Pattern likely affects many users`;
    } else if (impact > 0.8) {
      reasoning = `High impact fix: Resolving this may address related issues`;
    } else {
      reasoning = `Standard priority: Address after higher-impact items`;
    }

    return {
      issue,
      rank: idx + 1,
      impact,
      reasoning,
    };
  });
}

