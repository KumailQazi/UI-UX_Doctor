"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileWarning,
  CheckCircle,
  XCircle,
  ListTodo,
  TrendingUp,
  DollarSign,
  BrainCircuit,
  ArrowRight,
  Github,
  Briefcase,
} from "lucide-react";

import { DEFAULT_PROJECT_ID } from "@/lib/constants";
import { type BillingStatusResponse } from "@/lib/billingSchema";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import DashboardSkeleton from "@/components/DashboardSkeleton";

interface DashboardData {
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
  issueTypeBreakdown: Array<{ issueType: string; count: number }>;
  feedbackTrend: Array<{ day: string; accepted: number; rejected: number }>;
  remainingIssues: Array<{
    issueId: string;
    summary: string;
    issueType: string;
    suggestedFix: string;
  }>;
}

interface IntegrationsStatusResponse {
  github: { configured: boolean };
  jira: { configured: boolean };
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("projectId") ?? DEFAULT_PROJECT_ID, [searchParams]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [integrationsStatus, setIntegrationsStatus] = useState<IntegrationsStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashboardRes, billingRes, integrationsRes] = await Promise.all([
          fetch(`/api/dashboard?projectId=${encodeURIComponent(projectId)}`),
          fetch(`/api/billing/status?projectId=${encodeURIComponent(projectId)}`),
          fetch("/api/integrations/status"),
        ]);

        if (!dashboardRes.ok) throw new Error("Failed to load dashboard analytics");
        if (billingRes.ok) setBillingStatus((await billingRes.json()) as BillingStatusResponse);
        if (integrationsRes.ok) setIntegrationsStatus((await integrationsRes.json()) as IntegrationsStatusResponse);

        setData((await dashboardRes.json()) as DashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    };

    loadData();
  }, [projectId]);

  const maxTrendValue = useMemo(() => {
    if (!data?.feedbackTrend?.length) return 1;
    return Math.max(1, ...data.feedbackTrend.map((item) => item.accepted + item.rejected));
  }, [data]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) {
    return <DashboardSkeleton />;
  }

  const githubConfigured = integrationsStatus?.github.configured;
  const jiraConfigured = integrationsStatus?.jira.configured;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <DashboardHeader projectId={projectId} billingStatus={billingStatus} />

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Integrations Health</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              githubConfigured === true
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : githubConfigured === false
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600"
            }`}
          >
            <Github className="h-3.5 w-3.5" />
            GitHub:{" "}
            {githubConfigured === true
              ? "Configured"
              : githubConfigured === false
                ? "Not configured"
                : "Checking..."}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              jiraConfigured === true
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : jiraConfigured === false
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Jira:{" "}
            {jiraConfigured === true
              ? "Configured"
              : jiraConfigured === false
                ? "Not configured"
                : "Checking..."}
          </span>
        </div>

        {githubConfigured === false || jiraConfigured === false ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Fix configuration</p>
            <p className="mt-1 text-xs text-rose-800">
              Add the following variables in <code>.env.local</code> and restart the app:
            </p>

            {githubConfigured === false ? (
              <div className="mt-2">
                <p className="text-xs font-semibold text-rose-800">GitHub</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-rose-900">
                  <li><code>UIUX_DOCTOR_GITHUB_REPO</code></li>
                  <li><code>UIUX_DOCTOR_GITHUB_TOKEN</code></li>
                  <li><code>UIUX_DOCTOR_GITHUB_LABELS</code> (optional)</li>
                </ul>
              </div>
            ) : null}

            {jiraConfigured === false ? (
              <div className="mt-2">
                <p className="text-xs font-semibold text-rose-800">Jira</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-rose-900">
                  <li><code>UIUX_DOCTOR_JIRA_BASE_URL</code></li>
                  <li><code>UIUX_DOCTOR_JIRA_EMAIL</code></li>
                  <li><code>UIUX_DOCTOR_JIRA_API_TOKEN</code></li>
                  <li><code>UIUX_DOCTOR_JIRA_PROJECT_KEY</code></li>
                  <li><code>UIUX_DOCTOR_JIRA_ISSUE_TYPE</code> (optional)</li>
                  <li><code>UIUX_DOCTOR_JIRA_LABELS</code> (optional)</li>
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Issues Detected" value={data.totals.issuesDetected} Icon={FileWarning} />
        <StatCard
          title="Accepted Fixes"
          value={data.totals.accepted}
          Icon={CheckCircle}
          className="bg-emerald-50/50 border-emerald-200"
        />
        <StatCard
          title="Rejected Fixes"
          value={data.totals.rejected}
          Icon={XCircle}
          className="bg-amber-50/50 border-amber-200"
        />
        <StatCard
          title="Remaining"
          value={data.totals.remaining}
          Icon={ListTodo}
          className="bg-indigo-50/50 border-indigo-200"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Acceptance Rate" value={`${data.totals.acceptanceRate}%`} Icon={TrendingUp} />
        <StatCard
          title="Est. Recovery"
          value={`$${data.totals.estimatedRecoveryUSD.toLocaleString()}`}
          Icon={DollarSign}
          description="From accepted fixes"
        />
        <StatCard
          title="Top Learned Preference"
          value={data.totals.topLearnedPreference}
          Icon={BrainCircuit}
          description="From accepted fixes"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Issue Type Breakdown</h2>
          <ul className="mt-3 space-y-2">
            {data.issueTypeBreakdown.map((item) => (
              <li key={item.issueType}>
                <Link
                  href={`/results/last?projectId=${encodeURIComponent(projectId)}&issueType=${encodeURIComponent(item.issueType)}`}
                  className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 transition-all hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-md"
                >
                  <span className="text-sm font-medium text-zinc-800">{item.issueType}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                      {item.count}
                    </span>
                    <ArrowRight className="h-4 w-4 text-indigo-600" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Feedback Trend (7d)</h2>
          {data.feedbackTrend.length > 0 ? (
            <div className="mt-3 flex h-48 items-end gap-2 rounded-lg bg-zinc-50 p-2">
              {data.feedbackTrend.map((point) => {
                const total = point.accepted + point.rejected;
                const acceptedHeight = total > 0 ? (point.accepted / total) * 100 : 0;
                const barHeight = Math.max(2, (total / maxTrendValue) * 100);
                return (
                  <div key={point.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div className="relative w-full rounded-t-md bg-amber-200" style={{ height: `${barHeight}%` }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t-md bg-emerald-300"
                        style={{ height: `${acceptedHeight}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-medium text-zinc-500">{point.day}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No feedback trend yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Next Steps: Remaining Issues</h2>
        {data.remainingIssues.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {data.remainingIssues.map((issue) => (
              <li key={issue.issueId}>
                <Link
                  href={`/results/last?projectId=${encodeURIComponent(projectId)}&issueId=${encodeURIComponent(issue.issueId)}`}
                  className="block rounded-md border border-zinc-200 p-3 transition-all hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-zinc-900">{issue.summary}</p>
                  <p className="mt-1 text-xs text-indigo-700">Suggestion: {issue.suggestedFix}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-semibold text-emerald-700">🎉 No remaining issues detected. Great work!</p>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 md:px-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
