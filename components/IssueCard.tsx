"use client";

import { ShieldAlert, BarChart, CheckCircle, XCircle } from "lucide-react";
import type { Issue } from "@/lib/issueSchema";

type FeedbackStatus = "accepted" | "rejected" | undefined;

interface IssueCardProps {
  issue: Issue;
  selected: boolean;
  loading: boolean;
  feedback: FeedbackStatus;
  onSelect: (issue: Issue) => void;
  onGenerateFix: (issue: Issue) => void;
}

const severityStyles: Record<Issue["severity"], { icon: React.ElementType; className: string }> = {
  high: {
    icon: ShieldAlert,
    className: "text-red-700 bg-red-50 border-red-200",
  },
  medium: {
    icon: ShieldAlert,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  low: {
    icon: ShieldAlert,
    className: "text-zinc-700 bg-zinc-50 border-zinc-200",
  },
};

export default function IssueCard({
  issue,
  selected,
  loading,
  feedback,
  onSelect,
  onGenerateFix,
}: IssueCardProps) {
  const confidencePercent = Math.round(issue.confidence * 100);
  const SeverityIcon = severityStyles[issue.severity].icon;
  const isActionable = !feedback;

  return (
    <article
      className={`relative rounded-lg border p-4 transition-all ${
        selected ? "border-indigo-500 bg-indigo-50/50 shadow-md" : "border-zinc-200 bg-white hover:bg-zinc-50"
      }`}
    >
      {feedback && (
        <div
          className={`absolute inset-0 z-10 rounded-lg ${
            feedback === "accepted" ? "bg-emerald-50/50" : "bg-zinc-50/50"
          }`}
        />
      )}
      <div className="relative z-20">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
              severityStyles[issue.severity].className
            }`}
          >
            <SeverityIcon className="h-3.5 w-3.5" />
            <span>{issue.severity.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <BarChart className="h-3.5 w-3.5" />
            <span>{confidencePercent}% confidence</span>
          </div>
        </div>

        <h3 className="mt-3 text-sm font-semibold text-zinc-900">{issue.summary}</h3>
        <p className="mt-1 text-xs text-zinc-600">{issue.whyItMatters}</p>

        {isActionable && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onSelect(issue)}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-100"
            >
              View Details
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onGenerateFix(issue)}
              className="flex-1 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Generating..." : "Generate Fix"}
            </button>
          </div>
        )}

        {feedback && (
          <div className="mt-4">
            {feedback === "accepted" ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 py-1.5 px-3 text-xs font-semibold text-emerald-800">
                <CheckCircle className="h-4 w-4" />
                <span>Fix Accepted</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 py-1.5 px-3 text-xs font-semibold text-zinc-600">
                <XCircle className="h-4 w-4" />
                <span>Fix Rejected</span>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
