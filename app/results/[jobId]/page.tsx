"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import BeforeAfterView from "@/components/BeforeAfterView";
import CodeDiffPanel from "@/components/CodeDiffPanel";
import IssueCard from "@/components/IssueCard";
import type { GenerateFixResponse, Issue } from "@/lib/issueSchema";

interface AnalyzeApiResponse {
  projectId: string;
  jobId: string;
  issues: Issue[];
}

interface SessionData {
  userContext?: {
    viewport?: {
      width?: number;
      height?: number;
    };
  };
  events?: Array<{
    eventType?: string;
    timestampSec?: number;
    x?: number;
    y?: number;
    result?: string;
    target?: string;
  }>;
}

type FeedbackStatus = "accepted" | "rejected";
type FeedbackAction = "accept" | "reject" | null;

interface BillingStatusResponse {
  projectId: string;
  plan: "free" | "pro" | "enterprise";
  usage: {
    analyze: { used: number; limit: number; remaining: number };
    generate_fix: { used: number; limit: number; remaining: number };
  };
}

const suggestionByType: Record<Issue["type"], string> = {
  dead_click: "Convert clickable-looking cards to semantic selectable buttons with focus-visible states.",
  mobile_hidden_cta:
    "Add sticky mobile CTA placement and keep desktop behavior unchanged with responsive classes.",
};

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ResultsPage() {
  const params = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("projectId") ?? "demo-project", [searchParams]);
  const targetIssueId = useMemo(() => searchParams.get("issueId"), [searchParams]);
  const targetIssueType = useMemo(() => searchParams.get("issueType"), [searchParams]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [fix, setFix] = useState<GenerateFixResponse | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [generatingFix, setGeneratingFix] = useState(false);
  const [status, setStatus] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState<FeedbackAction>(null);
  const [feedbackByIssueId, setFeedbackByIssueId] = useState<Record<string, FeedbackStatus>>({});
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [heatmapSource, setHeatmapSource] = useState<"real session evidence" | "seeded fallback">(
    "seeded fallback"
  );
  const detailsPanelRef = useRef<HTMLElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const loadIssues = async () => {
      setLoadingIssues(true);
      try {
        let sessionData: SessionData | undefined;
        const storageKey = `componentDoctorSessionData:${projectId}`;
        const rawSessionData = sessionStorage.getItem(storageKey);

        if (rawSessionData) {
          try {
            sessionData = JSON.parse(rawSessionData) as SessionData;
          } catch {
            setStatus("Stored session data is invalid JSON. Using demo analysis.");
          }
        }

        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, sessionData }),
        });

        if (!response.ok) {
          throw new Error("Unable to load analysis");
        }

        const data = (await response.json()) as AnalyzeApiResponse;
        const hasRealHeatmapEvidence =
          Boolean(sessionData?.events?.length) &&
          data.issues.some((issue) => Boolean(issue.heatmapPoints?.length));

        setHeatmapSource(hasRealHeatmapEvidence ? "real session evidence" : "seeded fallback");
        setIssues(data.issues);

        const targetIssueById = targetIssueId
          ? data.issues.find((issue) => issue.issueId === targetIssueId) ?? null
          : null;
        const targetIssueByType = targetIssueType
          ? data.issues.find((issue) => issue.type === targetIssueType) ?? null
          : null;

        setSelectedIssue(targetIssueById ?? targetIssueByType ?? data.issues[0] ?? null);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unexpected error");
      } finally {
        setLoadingIssues(false);
      }
    };

    loadIssues();
  }, [projectId, targetIssueId, targetIssueType]);

  const generateFix = async (issue: Issue) => {
    setGeneratingFix(true);
    setStatus("Generating patch...");
    setSelectedIssue(issue);

    try {
      const response = await fetch("/api/generate-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, issue }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate UI/UX prescription");
      }

      const data = (await response.json()) as GenerateFixResponse;
      setFix(data);
      setStatus("UI/UX prescription generated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setGeneratingFix(false);
    }
  };

  const sendFeedback = async (fixAccepted: boolean) => {
    if (!selectedIssue) {
      return;
    }

    const action: FeedbackAction = fixAccepted ? "accept" : "reject";
    setSubmittingFeedback(action);
    setStatus(fixAccepted ? "Saving accepted feedback..." : "Saving rejected feedback...");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          issueId: selectedIssue.issueId,
          fixAccepted,
          editedByUser: false,
          notes: fixAccepted
            ? "Great UI/UX prescription. Keep sticky CTA and strong focus states."
            : "Needs additional layout tuning.",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save feedback");
      }

      setFeedbackByIssueId((current) => ({
        ...current,
        [selectedIssue.issueId]: fixAccepted ? "accepted" : "rejected",
      }));
      setStatus(
        fixAccepted
          ? "✅ UI/UX prescription accepted and saved to team memory."
          : "⚠️ UI/UX prescription rejected and feedback saved."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected error while saving feedback");
    } finally {
      setSubmittingFeedback(null);
    }
  };

  const selectedFeedback = selectedIssue ? feedbackByIssueId[selectedIssue.issueId] : undefined;
  const feedbackLocked = selectedFeedback !== undefined;

  const remainingIssues = issues.filter((issue) => feedbackByIssueId[issue.issueId] !== "accepted");

  const evidenceTimeline = useMemo(
    () =>
      issues
        .flatMap((issue) =>
          issue.evidence.map((ev) => ({
            issueId: issue.issueId,
            issueType: issue.type,
            timestampSec: ev.timestampSec,
            note: ev.note,
          }))
        )
        .sort((a, b) => a.timestampSec - b.timestampSec),
    [issues]
  );

  const maxTs = evidenceTimeline.length > 0 ? Math.max(...evidenceTimeline.map((item) => item.timestampSec), 1) : 1;

  useEffect(() => {
    const loadBillingStatus = async () => {
      try {
        const response = await fetch(`/api/billing/status?projectId=${encodeURIComponent(projectId)}`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as BillingStatusResponse;
        setBillingStatus(payload);
      } catch {
        setBillingStatus(null);
      }
    };

    loadBillingStatus();
  }, [projectId, loadingIssues, fix]);

  useEffect(() => {
    const panel = detailsPanelRef.current;
    if (!panel) {
      setCanScrollDown(false);
      return;
    }

    const updateScrollState = () => {
      setCanScrollDown(panel.scrollTop + panel.clientHeight < panel.scrollHeight - 8);
    };

    updateScrollState();
    panel.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    const frame = window.requestAnimationFrame(updateScrollState);

    return () => {
      window.cancelAnimationFrame(frame);
      panel.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [loadingIssues, selectedIssue?.issueId, fix, selectedFeedback, issues.length]);

  return (
    <main className="h-screen overflow-hidden bg-zinc-100 px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
        <header className="shrink-0">
          <h1 className="text-2xl font-bold text-zinc-900">Analysis Results</h1>
          <p className="text-sm text-zinc-600">
            Job ID: {params.jobId} · Project: {projectId}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {status ? <p className="text-sm text-indigo-700">{status}</p> : null}
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                heatmapSource === "real session evidence"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              Heatmap source: {heatmapSource}
            </span>
            {billingStatus ? (
              <>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                  Plan: {billingStatus.plan.toUpperCase()}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                  Analyze: {billingStatus.usage.analyze.used}/{billingStatus.usage.analyze.limit}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                  Fixes: {billingStatus.usage.generate_fix.used}/{billingStatus.usage.generate_fix.limit}
                </span>
              </>
            ) : null}
            <Link
              href="/"
              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Go to First Page
            </Link>
            <Link
              href="/upload"
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Upload New Session
            </Link>
            <Link
              href={`/dashboard?projectId=${encodeURIComponent(projectId)}`}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Open UI/UX Analytics
            </Link>
          </div>
        </header>

        <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Frustration timeline</p>
          <div className="relative mt-2 h-9 rounded bg-zinc-100">
            {evidenceTimeline.map((item, index) => {
              const left = (item.timestampSec / maxTs) * 100;
              const color =
                item.issueType === "dead_click"
                  ? "bg-rose-500"
                  : item.issueType === "mobile_hidden_cta"
                    ? "bg-amber-500"
                    : "bg-indigo-500";

              return (
                <div
                  key={`${item.issueId}-${index}`}
                  className={`absolute top-1.5 h-6 w-1.5 rounded ${color}`}
                  style={{ left: `${Math.min(98, Math.max(1, left))}%` }}
                  title={`${formatTs(item.timestampSec)} — ${item.note}`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
            <span>0:00</span>
            <span>{formatTs(maxTs)}</span>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {loadingIssues ? (
            <p className="text-sm text-zinc-600">Loading detected issues...</p>
          ) : (
            <div className="grid h-full gap-6 lg:grid-cols-[320px_1fr]">
              <aside className="h-full space-y-3 overflow-y-auto pr-1">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.issueId}
                    issue={issue}
                    selected={selectedIssue?.issueId === issue.issueId}
                    loading={generatingFix}
                    onSelect={(nextIssue) => {
                      setSelectedIssue(nextIssue);
                      setFix(null);
                    }}
                    onGenerateFix={generateFix}
                  />
                ))}
              </aside>

              <section ref={detailsPanelRef} className="relative h-full space-y-4 overflow-y-auto pr-1 pb-14">
                {selectedIssue ? (
                  <BeforeAfterView
                    issueType={selectedIssue.type}
                    heatmapPoints={selectedIssue.heatmapPoints}
                    peakLabel={selectedIssue.peakLabel}
                  />
                ) : null}

                {selectedIssue?.evidence.length ? (
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidence details</p>
                    <ul className="mt-2 space-y-1.5">
                      {selectedIssue.evidence.map((ev, index) => (
                        <li key={`${ev.timestampSec}-${index}`} className="rounded border border-zinc-200 bg-zinc-50 p-2">
                          <p className="text-xs font-semibold text-zinc-800">t={formatTs(ev.timestampSec)}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-600">{ev.note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {fix ? <CodeDiffPanel fix={fix} /> : null}

                {fix ? (
                  <div className="space-y-2 pb-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={feedbackLocked || submittingFeedback !== null}
                        onClick={() => sendFeedback(true)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {selectedFeedback === "accepted"
                          ? "Accepted"
                          : submittingFeedback === "accept"
                            ? "Saving..."
                            : "Accept prescription"}
                      </button>
                      <button
                        type="button"
                        disabled={feedbackLocked || submittingFeedback !== null}
                        onClick={() => sendFeedback(false)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {selectedFeedback === "rejected"
                          ? "Rejected"
                          : submittingFeedback === "reject"
                            ? "Saving..."
                            : "Reject prescription"}
                      </button>
                    </div>

                    {selectedFeedback ? (
                      <p
                        className={`text-xs font-medium ${
                          selectedFeedback === "accepted" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {selectedFeedback === "accepted"
                          ? "This UI/UX prescription is marked as accepted for this issue."
                          : "This UI/UX prescription is marked as rejected for this issue."}
                      </p>
                    ) : null}

                    {selectedFeedback === "accepted" ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                            Remaining UI/UX issues
                          </p>
                          {remainingIssues.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {remainingIssues.map((issue) => (
                                <li key={issue.issueId} className="rounded-md border border-indigo-100 bg-white p-2">
                                  <p className="text-xs font-semibold text-zinc-900">{issue.summary}</p>
                                  <p className="mt-1 text-[11px] text-zinc-600">
                                    Next UI/UX prescription: {suggestionByType[issue.type]}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-emerald-700">
                              Great work — no remaining issues detected in this run.
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                                Partner integration preview
                              </p>
                              <p className="mt-1 text-xs text-sky-800">
                                Create a Jira ticket for this accepted UI/UX prescription so engineering can track rollout.
                              </p>
                              <p className="mt-1 text-[11px] text-sky-700">
                                Project: {projectId} · Issue: {selectedIssue?.issueId}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                              title="Demo preview only"
                            >
                              Create Jira Issue (Preview)
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {canScrollDown ? (
                      <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-20 flex justify-center">
                        <button
                          type="button"
                          onClick={() => detailsPanelRef.current?.scrollBy({ top: 280, behavior: "smooth" })}
                          className="pointer-events-auto animate-bounce rounded-full border border-indigo-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700 shadow-sm hover:bg-indigo-50"
                        >
                          ↓ Scroll for more
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">Start a UI/UX consultation from the issue panel to see code output.</p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
