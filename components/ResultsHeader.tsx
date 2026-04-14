import Link from "next/link";
import { HardDrive, FilePlus, LayoutDashboard, TestTube2, CheckCircle, BarChart, FileWarning } from "lucide-react";
import { type BillingStatusResponse } from "@/lib/billingSchema";

interface ResultsHeaderProps {
  jobId: string;
  projectId: string;
  status: string;
  heatmapSource: "real session evidence" | "seeded fallback";
  billingStatus: BillingStatusResponse | null;
}

const StatChip: React.FC<{ icon: React.ElementType; label: string; value: string | number; }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1">
    <Icon className="h-3.5 w-3.5 text-zinc-500" />
    <span className="text-[11px] font-medium text-zinc-700">
      {label}: <span className="font-semibold">{value}</span>
    </span>
  </div>
);

export default function ResultsHeader({
  jobId,
  projectId,
  status,
  heatmapSource,
  billingStatus,
}: ResultsHeaderProps) {
  return (
    <header className="shrink-0">
      <h1 className="text-2xl font-bold text-zinc-900">Analysis Results</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-zinc-500">
          Job ID: <span className="font-semibold text-zinc-700">{jobId}</span>
        </p>
        <p className="text-sm text-zinc-500">
          Project: <span className="font-semibold text-zinc-700">{projectId}</span>
        </p>
        {status ? <p className="text-sm font-semibold text-indigo-700">{status}</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
            heatmapSource === "real session evidence"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {heatmapSource === "real session evidence" ? <CheckCircle className="h-3.5 w-3.5" /> : <TestTube2 className="h-3.5 w-3.5" />}
          {heatmapSource}
        </div>
        
        {billingStatus && (
          <>
            <StatChip icon={HardDrive} label="Plan" value={billingStatus.plan.toUpperCase()} />
            <StatChip
              icon={BarChart}
              label="Analyze Credits"
              value={`${billingStatus.usage.analyze.used} / ${billingStatus.usage.analyze.limit}`}
            />
            <StatChip
              icon={FileWarning}
              label="Fix Credits"
              value={`${billingStatus.usage.generate_fix.used} / ${billingStatus.usage.generate_fix.limit}`}
            />
          </>
        )}
        <div className="flex-1" />
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          <FilePlus className="h-4 w-4" />
          Upload New Session
        </Link>
        <Link
          href={`/dashboard?projectId=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-700"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    </header>
  );
}
