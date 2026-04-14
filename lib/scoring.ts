import type { Issue, Severity } from "@/lib/issueSchema";

const severityScore: Record<Severity, number> = {
  high: 0.95,
  medium: 0.75,
  low: 0.55,
};

export function rankIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => scoreIssue(b) - scoreIssue(a));
}

export function scoreIssue(issue: Issue): number {
  const base = severityScore[issue.severity] ?? 0.5;
  const confidence = Math.max(0, Math.min(1, issue.confidence));
  return Number((base * 0.7 + confidence * 0.3).toFixed(4));
}
