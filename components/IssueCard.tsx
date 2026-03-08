"use client";

import type { Issue } from "@/lib/issueSchema";

interface IssueCardProps {
  issue: Issue;
  selected: boolean;
  loading: boolean;
  onSelect: (issue: Issue) => void;
  onGenerateFix: (issue: Issue) => void;
}

const severityTone: Record<Issue["severity"], string> = {
  high: "text-red-700 bg-red-50 border-red-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-zinc-700 bg-zinc-50 border-zinc-200",
};

export default function IssueCard({
  issue,
  selected,
  loading,
  onSelect,
  onGenerateFix,
}: IssueCardProps) {
  const confidencePercent = Math.round(issue.confidence * 100);

  return (
    <article
      className={`rounded-lg border p-4 transition ${
        selected ? "border-indigo-500 bg-indigo-50/40" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severityTone[issue.severity]}`}>
          {issue.severity.toUpperCase()}
        </span>
        <span className="text-xs text-zinc-500">{confidencePercent}% confidence</span>
      </div>

      <div className="mt-2 h-1.5 w-full rounded bg-zinc-200">
        <div
          className="h-1.5 rounded bg-indigo-600 transition-all"
          style={{ width: `${confidencePercent}%` }}
          aria-hidden
        />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-zinc-900">{issue.summary}</h3>
      <p className="mt-1 text-xs text-zinc-600">{issue.whyItMatters}</p>

      {issue.evidence.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Session evidence</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {issue.evidence.map((item, index) => (
              <span
                key={`${item.timestampSec}-${index}`}
                className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700"
                title={item.note}
              >
                t={item.timestampSec}s
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onSelect(issue)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          View details
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onGenerateFix(issue)}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-70"
        >
          {loading ? "Consulting UI/UX Doctor..." : "Consult UI/UX Doctor"}
        </button>
      </div>
    </article>
  );
}
