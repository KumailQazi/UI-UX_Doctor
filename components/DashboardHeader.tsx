"use client";

import Link from "next/link";
import { FilePlus, ArrowLeft } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { type BillingStatusResponse } from "@/lib/billingSchema";

interface DashboardHeaderProps {
  projectId: string;
  billingStatus: BillingStatusResponse | null;
}

export default function DashboardHeader({ projectId, billingStatus }: DashboardHeaderProps) {
  return (
    <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {APP_NAME}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Project: <span className="font-semibold text-zinc-700">{projectId}</span>
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Link
            href={`/results/last?projectId=${encodeURIComponent(projectId)}`}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Results
          </Link>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <FilePlus className="h-4 w-4" />
            New Analysis
          </Link>
        </div>
      </div>
      {billingStatus && (
        <div className="mt-3 border-t border-zinc-200 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
              Plan: {billingStatus.plan.toUpperCase()}
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
              Analyze Credits: {billingStatus.usage.analyze.used}/{billingStatus.usage.analyze.limit}
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
              Fix Credits: {billingStatus.usage.generate_fix.used}/{billingStatus.usage.generate_fix.limit}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
