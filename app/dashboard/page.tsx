"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

interface BillingStatusResponse {
  projectId: string;
  plan: "free" | "pro" | "enterprise";
  usage: {
    analyze: { used: number; limit: number; remaining: number };
    generate_fix: { used: number; limit: number; remaining: number };
  };
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("projectId") ?? "demo-project", [searchParams]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [status, setStatus] = useState("Loading analytics...");

  useEffect(() => {
    const load = async () => {
      try {
        const [dashboardResponse, billingResponse] = await Promise.all([
          fetch(`/api/dashboard?projectId=${encodeURIComponent(projectId)}`),
          fetch(`/api/billing/status?projectId=${encodeURIComponent(projectId)}`),
        ]);

        if (!dashboardResponse.ok) {
          throw new Error("Failed to load dashboard analytics");
        }

        if (!billingResponse.ok) {
          throw new Error("Failed to load billing status");
        }

        const payload = (await dashboardResponse.json()) as DashboardData;
        const billingPayload = (await billingResponse.json()) as BillingStatusResponse;

        setData(payload);
        setBillingStatus(billingPayload);
        setStatus("Analytics loaded.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unexpected dashboard error");
      }
    };

    load();
  }, [projectId]);

  const maxTrendValue = useMemo(() => {
    if (!data?.feedbackTrend?.length) {
      return 1;
    }

    return Math.max(
      ...data.feedbackTrend.map((item) => item.accepted + item.rejected),
      1
    );
  }, [data]);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">UI/UX Doctor Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">UI/UX Doctor</h1>
          <p className="mt-1 text-sm text-zinc-600">Project: {projectId}</p>
          {billingStatus ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                Plan: {billingStatus.plan.toUpperCase()}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                Analyze: {billingStatus.usage.analyze.used}/{billingStatus.usage.analyze.limit}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                UI/UX Credits: {billingStatus.usage.generate_fix.used}/{billingStatus.usage.generate_fix.limit}
              </span>
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Link
              href="/upload"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              New Analysis
            </Link>
            <Link
              href={`/results/last?projectId=${encodeURIComponent(projectId)}`}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Back to Results
            </Link>
          </div>
        </header>

        <p className="text-sm text-zinc-600">{status}</p>

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-xs text-zinc-500">Issues detected</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{data.totals.issuesDetected}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Accepted fixes</p>
                <p className="mt-1 text-2xl font-bold text-emerald-800">{data.totals.accepted}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Rejected fixes</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">{data.totals.rejected}</p>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs text-indigo-700">Remaining issues</p>
                <p className="mt-1 text-2xl font-bold text-indigo-800">{data.totals.remaining}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-xs text-zinc-500">Acceptance rate</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{data.totals.acceptanceRate}%</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Why this matters in $$</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">
                  ${data.totals.estimatedRecoveryUSD.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-emerald-700">Estimated conversion recovery from accepted prescriptions.</p>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Learning memory</p>
                <p className="mt-1 text-xs font-semibold text-indigo-900">{data.totals.topLearnedPreference}</p>
                <p className="mt-1 text-[10px] text-indigo-700">Top learned team preference this week.</p>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-zinc-900">Issue Type Breakdown</h2>
                <ul className="mt-3 space-y-2">
                  {data.issueTypeBreakdown.map((item) => (
                    <li key={item.issueType}>
                      <Link
                        href={`/results/last?projectId=${encodeURIComponent(projectId)}&issueType=${encodeURIComponent(item.issueType)}`}
                        className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 transition hover:border-indigo-300 hover:bg-indigo-50/30"
                      >
                        <span className="text-sm text-zinc-700">{item.issueType}</span>
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                            {item.count}
                          </span>
                          <span className="text-[11px] font-semibold text-indigo-700">Open issue ↗</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-zinc-900">UI/UX Feedback Trend (7 days)</h2>
                {data.feedbackTrend.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {data.feedbackTrend.map((point) => {
                      const total = point.accepted + point.rejected;
                      const widthPct = Math.max(8, Math.round((total / maxTrendValue) * 100));
                      return (
                        <li key={point.day} className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-zinc-700">{point.day}</span>
                            <span className="text-zinc-600">
                              ✅ {point.accepted} · ❌ {point.rejected}
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 rounded bg-zinc-200">
                            <div
                              className="h-2 rounded bg-indigo-600"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-600">No feedback trend yet. Accept or reject fixes to populate this chart.</p>
                )}
              </article>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-zinc-900">Remaining Issues + UI/UX Prescriptions</h2>
              {data.remainingIssues.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {data.remainingIssues.map((issue) => (
                    <li key={issue.issueId}>
                      <Link
                        href={`/results/last?projectId=${encodeURIComponent(projectId)}&issueId=${encodeURIComponent(issue.issueId)}`}
                        className="block rounded-md border border-zinc-200 p-3 transition hover:border-indigo-300 hover:bg-indigo-50/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{issue.summary}</p>
                          <span className="text-[11px] font-semibold text-indigo-700">Open issue ↗</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">Type: {issue.issueType}</p>
                        <p className="mt-1 text-xs text-indigo-700">UI/UX suggestion: {issue.suggestedFix}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-emerald-700">No remaining issues. Great run 🎉</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 px-4 py-6 md:px-6">
          <p className="text-sm text-zinc-600">Loading dashboard...</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
