"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowDown, Briefcase, ExternalLink, Github } from "lucide-react";

import BeforeAfterView from "@/components/BeforeAfterView";
import CodeDiffPanel from "@/components/CodeDiffPanel";
import IssueCard from "@/components/IssueCard";
import ResultsHeader from "@/components/ResultsHeader";
import ResultsSkeleton from "@/components/ResultsSkeleton";
import { DEFAULT_PROJECT_ID, getSessionStorageKey } from "@/lib/constants";
import { type GenerateFixResponse, type Issue } from "@/lib/issueSchema";
import { type BillingStatusResponse } from "@/lib/billingSchema";
import { type SessionData } from "@/lib/sessionSchema";

interface AnalyzeApiResponse {
  projectId: string;
  jobId: string;
  issues: Issue[];
}

interface IntegrationsStatusResponse {
  github: { configured: boolean };
  jira: { configured: boolean };
}

type FeedbackStatus = "accepted" | "rejected";
type FeedbackAction = "accept" | "reject" | null;
type DetailsTab = "evidence" | "prescription";

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ResultsView() {
  const params = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("projectId") ?? DEFAULT_PROJECT_ID, [searchParams]);
  const targetIssueId = useMemo(() => searchParams.get("issueId"), [searchParams]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [fix, setFix] = useState<GenerateFixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingFix, setGeneratingFix] = useState(false);
  const [status, setStatus] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState<FeedbackAction>(null);
  const [creatingGithubIssue, setCreatingGithubIssue] = useState(false);
  const [createdGithubIssueUrl, setCreatedGithubIssueUrl] = useState<string | null>(null);
  const [creatingJiraIssue, setCreatingJiraIssue] = useState(false);
  const [createdJiraIssueUrl, setCreatedJiraIssueUrl] = useState<string | null>(null);
  const [feedbackByIssueId, setFeedbackByIssueId] = useState<Record<string, FeedbackStatus>>({});
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [integrationsStatus, setIntegrationsStatus] = useState<IntegrationsStatusResponse | null>(null);
  const [heatmapSource, setHeatmapSource] = useState<"real session evidence" | "seeded fallback">("seeded fallback");
  const [activeTab, setActiveTab] = useState<DetailsTab>("evidence");

  const detailsPanelRef = useRef<HTMLElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setStatus("Analyzing session...");
      try {
        // Fetch issues
        let sessionData: SessionData | undefined;
        const rawSessionData = sessionStorage.getItem(getSessionStorageKey(projectId));
        if (rawSessionData) {
          try {
            sessionData = JSON.parse(rawSessionData) as SessionData;
          } catch {
            setStatus("Using demo analysis due to invalid session data.");
          }
        }

        const analyzeResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, sessionData }),
        });
        if (!analyzeResponse.ok) throw new Error("Unable to load analysis");
        const data = (await analyzeResponse.json()) as AnalyzeApiResponse;

        const hasRealHeatmap = data.issues.some((issue) => issue.heatmapPoints && issue.heatmapPoints.length > 0);
        setHeatmapSource(hasRealHeatmap ? "real session evidence" : "seeded fallback");
        setIssues(data.issues);

        const issueToSelect = targetIssueId
          ? data.issues.find((i) => i.issueId === targetIssueId)
          : data.issues[0];
        if (issueToSelect) setSelectedIssue(issueToSelect);

        // Fetch billing status
        const billingResponse = await fetch(`/api/billing/status?projectId=${encodeURIComponent(projectId)}`);
        if (billingResponse.ok) {
          setBillingStatus((await billingResponse.json()) as BillingStatusResponse);
        }

        const integrationsResponse = await fetch("/api/integrations/status");
        if (integrationsResponse.ok) {
          setIntegrationsStatus((await integrationsResponse.json()) as IntegrationsStatusResponse);
        }

        setStatus("");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, targetIssueId]);

  const generateFix = async (issue: Issue) => {
    setGeneratingFix(true);
    setStatus("Generating prescription...");
    setSelectedIssue(issue);
    setFix(null);
    setCreatedGithubIssueUrl(null);
    setCreatedJiraIssueUrl(null);
    setActiveTab("prescription");

    try {
      const response = await fetch("/api/generate-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, issue }),
      });
      if (!response.ok) throw new Error("Failed to generate prescription");
      setFix((await response.json()) as GenerateFixResponse);
      setStatus("UI/UX prescription generated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error generating prescription");
    } finally {
      setGeneratingFix(false);
    }
  };

  const sendFeedback = async (fixAccepted: boolean) => {
    if (!selectedIssue) return;
    const action: FeedbackAction = fixAccepted ? "accept" : "reject";
    setSubmittingFeedback(action);
    setStatus(`Saving ${action}ed feedback...`);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          issueId: selectedIssue.issueId,
          fixAccepted,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save feedback");
      }

      const feedbackStatus: FeedbackStatus = fixAccepted ? "accepted" : "rejected";
      setFeedbackByIssueId((prev) => ({ ...prev, [selectedIssue.issueId]: feedbackStatus }));
      setStatus(`✅ Prescription ${action}ed and saved to team memory.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error saving feedback.");
    } finally {
      setSubmittingFeedback(null);
    }
  };

  const createGithubIssue = async () => {
    if (!selectedIssue || !fix) {
      return;
    }

    setCreatingGithubIssue(true);
    setStatus("Creating GitHub issue...");
    setCreatedGithubIssueUrl(null);

    try {
      const response = await fetch("/api/integrations/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          jobId: params.jobId,
          issue: selectedIssue,
          fix,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        issueUrl?: string;
      };

      if (!response.ok || !payload.issueUrl) {
        throw new Error(payload.error || "Failed to create GitHub issue");
      }

      setCreatedGithubIssueUrl(payload.issueUrl);
      setStatus("✅ GitHub issue created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create GitHub issue");
    } finally {
      setCreatingGithubIssue(false);
    }
  };

  const createJiraIssue = async () => {
    if (!selectedIssue || !fix) {
      return;
    }

    setCreatingJiraIssue(true);
    setStatus("Creating Jira issue...");
    setCreatedJiraIssueUrl(null);

    try {
      const response = await fetch("/api/integrations/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          jobId: params.jobId,
          issue: selectedIssue,
          fix,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        issueUrl?: string;
      };

      if (!response.ok || !payload.issueUrl) {
        throw new Error(payload.error || "Failed to create Jira issue");
      }

      setCreatedJiraIssueUrl(payload.issueUrl);
      setStatus("✅ Jira issue created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create Jira issue");
    } finally {
      setCreatingJiraIssue(false);
    }
  };

  const evidenceTimeline = useMemo(() =>
    issues
      .flatMap((issue) => issue.evidence.map((ev) => ({ ...ev, issueId: issue.issueId, type: issue.type })))
      .sort((a, b) => a.timestampSec - b.timestampSec),
    [issues]
  );
  const maxTs = useMemo(() => Math.max(1, ...evidenceTimeline.map((ev) => ev.timestampSec)), [evidenceTimeline]);

  useEffect(() => {
    const panel = detailsPanelRef.current;
    if (!panel) return;
    const updateScroll = () => setCanScrollDown(panel.scrollTop + panel.clientHeight < panel.scrollHeight - 10);
    panel.addEventListener("scroll", updateScroll);
    const observer = new ResizeObserver(updateScroll);
    observer.observe(panel);
    updateScroll();
    return () => {
      panel.removeEventListener("scroll", updateScroll);
      observer.disconnect();
    };
  }, [fix, activeTab]);

  if (loading) {
    return <ResultsSkeleton />;
  }

  const selectedFeedback = selectedIssue ? feedbackByIssueId[selectedIssue.issueId] : undefined;
  const feedbackLocked = selectedFeedback !== undefined;
  const githubIntegrationConfigured = integrationsStatus?.github.configured ?? false;
  const jiraIntegrationConfigured = integrationsStatus?.jira.configured ?? false;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
      <ResultsHeader
        jobId={params.jobId}
        projectId={projectId}
        status={status}
        heatmapSource={heatmapSource}
        billingStatus={billingStatus}
      />

      <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Integration health</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              githubIntegrationConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <Github className="h-3.5 w-3.5" />
            GitHub: {githubIntegrationConfigured ? "Configured" : "Not configured"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              jiraIntegrationConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Jira: {jiraIntegrationConfigured ? "Configured" : "Not configured"}
          </span>
        </div>
      </div>

      {evidenceTimeline.length > 0 && (
        <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Frustration Timeline</p>
          <div className="relative mt-2 h-9 rounded bg-zinc-100">
            {evidenceTimeline.map((item, index) => {
              const left = (item.timestampSec / maxTs) * 100;
              const color = item.type === "dead_click" ? "bg-rose-500" : "bg-amber-500";
              return (
                <div
                  key={`${item.issueId}-${index}`}
                  className={`absolute top-1.5 h-6 w-1.5 rounded ${color}`}
                  style={{ left: `${Math.min(98.5, Math.max(0.5, left))}%` }}
                  title={`${formatTs(item.timestampSec)} - ${item.note}`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
            <span>0:00</span>
            <span>{formatTs(maxTs)}</span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <div className="grid h-full gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="h-full space-y-3 overflow-y-auto pr-1">
            {issues.map((issue) => (
              <IssueCard
                key={issue.issueId}
                issue={issue}
                selected={selectedIssue?.issueId === issue.issueId}
                loading={generatingFix && selectedIssue?.issueId === issue.issueId}
                feedback={feedbackByIssueId[issue.issueId]}
                onSelect={(i) => {
                  setSelectedIssue(i);
                  setFix(null);
                  setActiveTab("evidence");
                }}
                onGenerateFix={generateFix}
              />
            ))}
          </aside>

          <section ref={detailsPanelRef} className="relative h-full overflow-y-auto pr-1 pb-14">
            {selectedIssue && (
              <div className="flex flex-col gap-4">
                <BeforeAfterView
                  issueType={selectedIssue.type}
                  heatmapPoints={selectedIssue.heatmapPoints}
                  peakLabel={selectedIssue.peakLabel}
                />
                
                <div className="rounded-lg border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-200">
                    <nav className="-mb-px flex gap-4 px-4">
                      {["evidence", "prescription"].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab as DetailsTab)}
                          className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                            activeTab === tab
                              ? "border-indigo-500 text-indigo-600"
                              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                          }`}
                        >
                          {tab === "evidence" ? "Visual Evidence" : "Code Prescription"}
                        </button>
                      ))}
                    </nav>
                  </div>
                  <div className="p-4">
                    {activeTab === 'evidence' && (
                      <ul className="space-y-2">
                        {selectedIssue.evidence.map((ev, i) => (
                          <li key={i} className="rounded border border-zinc-200 bg-zinc-50 p-2">
                            <p className="text-xs font-semibold text-zinc-800">t={formatTs(ev.timestampSec)}</p>
                            <p className="mt-0.5 text-sm text-zinc-600">{ev.note}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {activeTab === 'prescription' && (
                      <div>
                        {generatingFix && <p className="text-sm text-zinc-600">Generating...</p>}
                        {fix && <CodeDiffPanel fix={fix} />}
                        {fix && (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={feedbackLocked || !!submittingFeedback}
                              onClick={() => sendFeedback(true)}
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {selectedFeedback === "accepted" ? "Accepted" : "Accept"}
                            </button>
                            <button
                              type="button"
                              disabled={feedbackLocked || !!submittingFeedback}
                              onClick={() => sendFeedback(false)}
                              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {selectedFeedback === "rejected" ? "Rejected" : "Reject"}
                            </button>
                            <button
                              type="button"
                              disabled={
                                !githubIntegrationConfigured ||
                                creatingGithubIssue ||
                                creatingJiraIssue ||
                                generatingFix
                              }
                              onClick={createGithubIssue}
                              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <Github className="h-3.5 w-3.5" />
                              {creatingGithubIssue ? "Creating issue..." : "Create GitHub issue"}
                            </button>
                            <button
                              type="button"
                              disabled={
                                !jiraIntegrationConfigured ||
                                creatingJiraIssue ||
                                creatingGithubIssue ||
                                generatingFix
                              }
                              onClick={createJiraIssue}
                              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <Briefcase className="h-3.5 w-3.5" />
                              {creatingJiraIssue ? "Creating issue..." : "Create Jira issue"}
                            </button>
                            {selectedFeedback && <p className="text-xs font-medium text-emerald-700">Feedback saved.</p>}
                            {createdGithubIssueUrl ? (
                              <a
                                href={createdGithubIssueUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-600"
                              >
                                Open GitHub issue
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            {createdJiraIssueUrl ? (
                              <a
                                href={createdJiraIssueUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-600"
                              >
                                Open Jira issue
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        )}
                        {!generatingFix && !fix && (
                          <p className="text-sm text-zinc-500">Generate a prescription from the issue card to see code changes.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {canScrollDown && (
              <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => detailsPanelRef.current?.scrollBy({ top: 250, behavior: "smooth" })}
                  className="pointer-events-auto animate-bounce rounded-full border border-indigo-200 bg-white p-2 text-indigo-700 shadow-lg hover:bg-indigo-50"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
