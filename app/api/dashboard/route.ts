import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Issue } from "@/lib/issueSchema";

interface FeedbackEntry {
  issueId: string;
  fixAccepted: boolean;
  editedByUser: boolean;
  notes?: string;
  createdAt: string;
}

interface PreferencesFile {
  projects: Record<
    string,
    {
      preferences: string[];
      feedbackLog: FeedbackEntry[];
    }
  >;
}

interface DashboardResponse {
  projectId: string;
  totals: {
    issuesDetected: number;
    accepted: number;
    rejected: number;
    remaining: number;
    acceptanceRate: number;
    estimatedRecoveryUSD: number;
    topLearnedPreference: string;
  };
  issueTypeBreakdown: Array<{
    issueType: string;
    count: number;
  }>;
  feedbackTrend: Array<{
    day: string;
    accepted: number;
    rejected: number;
  }>;
  remainingIssues: Array<{
    issueId: string;
    summary: string;
    issueType: string;
    suggestedFix: string;
  }>;
}

const suggestionByType: Record<string, string> = {
  dead_click: "Convert clickable-looking containers to semantic buttons with keyboard/focus states.",
  mobile_hidden_cta: "Add a sticky mobile CTA footer and preserve desktop behavior with responsive classes.",
};

function buildFeedbackTrend(feedbackLog: FeedbackEntry[]) {
  const map = new Map<string, { accepted: number; rejected: number }>();

  for (const entry of feedbackLog) {
    const day = entry.createdAt?.slice(0, 10) ?? "unknown";
    const current = map.get(day) ?? { accepted: 0, rejected: 0 };
    if (entry.fixAccepted) {
      current.accepted += 1;
    } else {
      current.rejected += 1;
    }
    map.set(day, current);
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-7)
    .map(([day, values]) => ({ day, ...values }));
}

function inferPreferenceFromNotes(notes?: string): string | null {
  if (!notes) {
    return null;
  }

  if (/sticky/i.test(notes) && /cta|button/i.test(notes)) {
    return "Use sticky mobile CTA for checkout";
  }

  if (/focus|keyboard|a11y|accessibility/i.test(notes)) {
    return "Prefer high-contrast focus-visible states";
  }

  return null;
}

function getTopLearnedPreferenceThisWeek(
  feedbackLog: FeedbackEntry[],
  storedPreferences: string[]
): string {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const learnedCounts = new Map<string, number>();

  for (const entry of feedbackLog) {
    if (!entry.fixAccepted) {
      continue;
    }

    const createdAtTs = Number(new Date(entry.createdAt));
    if (!Number.isFinite(createdAtTs) || createdAtTs < weekAgo) {
      continue;
    }

    const inferred = inferPreferenceFromNotes(entry.notes);
    if (!inferred) {
      continue;
    }

    learnedCounts.set(inferred, (learnedCounts.get(inferred) ?? 0) + 1);
  }

  if (learnedCounts.size > 0) {
    return [...learnedCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return storedPreferences.at(-1) ?? "No learned preference yet this week";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "demo-project";

  const issuesPath = path.join(process.cwd(), "data", "demo-issues.json");
  const preferencesPath = path.join(process.cwd(), "data", "preferences.json");

  const [issuesRaw, preferencesRaw] = await Promise.all([
    readFile(issuesPath, "utf-8"),
    readFile(preferencesPath, "utf-8"),
  ]);

  const issues = JSON.parse(issuesRaw) as Issue[];
  const preferencesData = JSON.parse(preferencesRaw) as PreferencesFile;

  const feedbackLog = preferencesData.projects?.[projectId]?.feedbackLog ?? [];
  const feedbackTrend = buildFeedbackTrend(feedbackLog);
  const storedPreferences = preferencesData.projects?.[projectId]?.preferences ?? [];

  const acceptedIssueIds = new Set(
    feedbackLog.filter((entry) => entry.fixAccepted).map((entry) => entry.issueId)
  );
  const rejectedIssueIds = new Set(
    feedbackLog.filter((entry) => !entry.fixAccepted).map((entry) => entry.issueId)
  );

  const remainingIssues = issues
    .filter((issue) => !acceptedIssueIds.has(issue.issueId))
    .map((issue) => ({
      issueId: issue.issueId,
      summary: issue.summary,
      issueType: issue.type,
      suggestedFix: suggestionByType[issue.type] ?? "Apply a minimal accessible UI fix with verification.",
    }));

  const issueTypeCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] ?? 0) + 1;
    return acc;
  }, {});

  const accepted = acceptedIssueIds.size;
  const rejected = rejectedIssueIds.size;
  const issuesDetected = issues.length;
  const remaining = remainingIssues.length;
  const attempted = accepted + rejected;
  const acceptanceRate = attempted > 0 ? Number(((accepted / attempted) * 100).toFixed(1)) : 0;
  const estimatedRecoveryUSD = accepted * 1250;
  const topLearnedPreference = getTopLearnedPreferenceThisWeek(feedbackLog, storedPreferences);

  const response: DashboardResponse = {
    projectId,
    totals: {
      issuesDetected,
      accepted,
      rejected,
      remaining,
      acceptanceRate,
      estimatedRecoveryUSD,
      topLearnedPreference,
    },
    issueTypeBreakdown: Object.entries(issueTypeCounts).map(([issueType, count]) => ({
      issueType,
      count,
    })),
    feedbackTrend,
    remainingIssues,
  };

  return NextResponse.json(response, { status: 200 });
}
