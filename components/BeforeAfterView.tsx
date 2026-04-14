"use client";

import { useMemo, useState } from "react";
import type { HeatmapPoint, IssueType } from "@/lib/issueSchema";

interface BeforeAfterViewProps {
  issueType: IssueType;
  heatmapPoints?: HeatmapPoint[];
  peakLabel?: string;
}

function DeadClickBeforeMock() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-[11px] font-semibold text-zinc-500">Pricing Cards (Broken)</p>
      <div className="mt-2 grid gap-2">
        <div className="rounded-md border border-zinc-200 p-2">
          <p className="text-xs font-semibold text-zinc-700">Starter</p>
          <p className="text-[11px] text-zinc-500">$9 / mo</p>
        </div>
        <div className="relative rounded-md border border-rose-300 bg-rose-50/50 p-2">
          <div className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
          <div className="cursor-pointer rounded-sm px-1 py-0.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100">
            Pro
          </div>
          <p className="text-[11px] text-zinc-500">$29 / mo</p>
          <p className="mt-1 text-[10px] font-medium text-rose-600">Looks clickable, no interaction</p>
        </div>
        <div className="rounded-md border border-zinc-200 p-2">
          <p className="text-xs font-semibold text-zinc-700">Enterprise</p>
          <p className="text-[11px] text-zinc-500">$99 / mo</p>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-rose-600">Peak frustration: repeated clicks on Pro (3x)</div>
    </div>
  );
}

function DeadClickAfterMock() {
  const [selectedPlan, setSelectedPlan] = useState<"Starter" | "Pro" | "Enterprise">("Pro");
  const plans: Array<{ name: "Starter" | "Pro" | "Enterprise"; price: string }> = [
    { name: "Starter", price: "$9 / mo" },
    { name: "Pro", price: "$29 / mo" },
    { name: "Enterprise", price: "$99 / mo" },
  ];

  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-3">
      <p className="text-[11px] font-semibold text-emerald-700">Pricing Cards (Fixed)</p>
      <div className="mt-2 grid gap-2">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.name;

          return (
            <button
              key={plan.name}
              type="button"
              onClick={() => setSelectedPlan(plan.name)}
              className={`rounded-md border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-zinc-300 bg-white hover:border-zinc-500"
              }`}
            >
              <p className="text-xs font-semibold text-zinc-900">{plan.name}</p>
              <p className="text-[11px] text-zinc-600">{plan.price}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Semantic selectable plan buttons + keyboard/focus support.
      </p>
      <div className="mt-2 text-[11px] text-emerald-700">Selected plan: {selectedPlan}</div>
    </div>
  );
}

function HiddenCtaBeforeMock() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-[11px] font-semibold text-zinc-500">Mobile Checkout (Broken)</p>
      <div className="relative mt-2 h-44 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-zinc-200" />
          <div className="h-3 w-full rounded bg-zinc-200" />
          <div className="h-3 w-5/6 rounded bg-zinc-200" />
          <div className="h-3 w-2/3 rounded bg-zinc-200" />
          <div className="h-3 w-4/5 rounded bg-zinc-200" />
          <div className="h-3 w-3/4 rounded bg-zinc-200" />
        </div>
        <div className="absolute bottom-2 right-2 rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
          CTA below fold
        </div>
      </div>
      <p className="mt-2 text-xs text-rose-600">Primary CTA is below fold and not visible.</p>
    </div>
  );
}

function HiddenCtaAfterMock() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-3">
      <p className="text-[11px] font-semibold text-emerald-700">Mobile Checkout (Fixed)</p>
      <div className="mt-2 h-44 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-zinc-200" />
          <div className="h-3 w-full rounded bg-zinc-200" />
          <div className="h-3 w-5/6 rounded bg-zinc-200" />
          <div className="h-3 w-2/3 rounded bg-zinc-200" />
        </div>
        <button
          type="button"
          onClick={() => setClicked(true)}
          className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
        >
          {clicked ? "Opening Payment…" : "Continue to Payment"}
        </button>
      </div>
      <p className="mt-2 text-xs text-emerald-700">Sticky CTA keeps next action visible.</p>
    </div>
  );
}

function HeatmapOverlay({
  points,
  peakLabel,
}: {
  points: HeatmapPoint[];
  peakLabel: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1]">
      {points.map((point, index) => {
        const size = 18 + point.intensity * 30;
        const alpha = 0.18 + point.intensity * 0.25;

        return (
          <div
            key={`heat-${index}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 blur-[1px]"
            style={{
              left: `${point.leftPct}%`,
              top: `${point.topPct}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity: alpha,
            }}
          />
        );
      })}

      {points.length > 0 ? (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded border border-rose-400 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
          style={{ left: `${points[0].leftPct}%`, top: `${Math.max(8, points[0].topPct - 10)}%` }}
        >
          {peakLabel}
        </div>
      ) : null}
    </div>
  );
}

function ComparisonSlider({
  before,
  after,
  issueType,
  heatmapPoints,
  peakLabel,
}: {
  before: React.ReactNode;
  after: React.ReactNode;
  issueType: IssueType;
  heatmapPoints?: HeatmapPoint[];
  peakLabel?: string;
}) {
  const [position, setPosition] = useState(50);

  const beforeLabel = useMemo(
    () =>
      issueType === "dead_click"
        ? "Pulsing red marker = repeated dead clicks"
        : "Warning marker = hidden CTA below fold",
    [issueType]
  );

  const seededHeatmapPoints = useMemo<HeatmapPoint[]>(
    () =>
      issueType === "dead_click"
        ? [
            { leftPct: 55, topPct: 38, intensity: 0.95 },
            { leftPct: 57, topPct: 42, intensity: 0.8 },
            { leftPct: 53, topPct: 40, intensity: 0.68 },
          ]
        : [
            { leftPct: 78, topPct: 82, intensity: 0.92 },
            { leftPct: 74, topPct: 78, intensity: 0.7 },
            { leftPct: 70, topPct: 75, intensity: 0.52 },
          ],
    [issueType]
  );

  const resolvedPoints = heatmapPoints && heatmapPoints.length > 0 ? heatmapPoints : seededHeatmapPoints;
  const resolvedPeakLabel =
    peakLabel ?? (issueType === "dead_click" ? "Peak: 7 taps" : "Peak: CTA miss");

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-wide">
        <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
          Previous UI (Before)
        </span>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
          Current UI (UI/UX Applied)
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-700">Buggy UI</p>
          <div className="relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
            {before}
            <HeatmapOverlay points={resolvedPoints} peakLabel={resolvedPeakLabel} />
          </div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Resolved UI</p>
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">{after}</div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          Interactive overlay comparison
        </p>
        <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          <div className="absolute inset-0">{before}</div>
          <HeatmapOverlay points={resolvedPoints} peakLabel={resolvedPeakLabel} />
          <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ width: `${100 - position}%` }}>
            <div className="h-full w-full">{after}</div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${position}%` }}>
            <div className="h-full w-0.5 bg-indigo-600/80" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
              ⬌
            </div>
          </div>
        </div>

        <div className="mt-2">
          <input
            type="range"
            min={5}
            max={95}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            className="w-full accent-indigo-600"
            aria-label="Pain to relief comparison slider"
          />
          <p className="mt-1 text-[11px] text-zinc-600">{beforeLabel}</p>
        </div>
      </div>
    </div>
  );
}

const beforeText: Record<IssueType, string> = {
  dead_click: "Users repeatedly tap a non-interactive element that appears clickable.",
  mobile_hidden_cta: "Users miss the next step because the primary CTA is hidden below the fold on mobile.",
};

const afterText: Record<IssueType, string> = {
  dead_click: "Replaced with semantic selectable buttons and accessible focus states.",
  mobile_hidden_cta: "Primary CTA is moved to a sticky mobile position with better visibility.",
};

export default function BeforeAfterView({
  issueType,
  heatmapPoints,
  peakLabel,
}: BeforeAfterViewProps) {
  const beforeMock = issueType === "dead_click" ? <DeadClickBeforeMock /> : <HiddenCtaBeforeMock />;
  const afterMock = issueType === "dead_click" ? <DeadClickAfterMock /> : <HiddenCtaAfterMock />;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Diagnosis</p>
          <p className="mt-1 text-sm text-zinc-700">{beforeText[issueType]}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Prescription</p>
          <p className="mt-1 text-sm text-emerald-800">{afterText[issueType]}</p>
        </div>
      </div>

      <ComparisonSlider
        before={beforeMock}
        after={afterMock}
        issueType={issueType}
        heatmapPoints={heatmapPoints}
        peakLabel={peakLabel}
      />
    </div>
  );
}
