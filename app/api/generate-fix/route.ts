import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { guardUsage, incrementUsage } from "@/lib/billing";
import { DEMO_MODE, PREFERENCES_PATH } from "@/lib/env";
import { generateFixWithLLM } from "@/lib/frontendFixAgent";
import { getModelForAgent } from "@/lib/modelRouter";
import type {
  GenerateFixRequest,
  GenerateFixResponse,
  Issue,
} from "@/lib/issueSchema";

interface PreferencesFile {
  projects?: Record<
    string,
    {
      preferences?: string[];
      feedbackLog?: unknown[];
    }
  >;
}

function getFixForIssue(issue: Issue) {
  if (issue.type === "dead_click") {
    return {
      diagnosis:
        "The element visually resembles a button but lacks semantic interactivity, causing repeated failed clicks.",
      fixPlan: [
        "Replace clickable-looking wrapper with a semantic <button>.",
        "Add keyboard and focus-visible affordances.",
        "Preserve existing click analytics with an explicit handler.",
      ],
      patchedCode: {
        react: `export function PricingCard({ title, onSelect }: { title: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-md border border-zinc-300 bg-white p-4 text-left transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
      aria-label={\`Select plan \${title}\`}
    >
      <span className="text-base font-semibold text-zinc-900">{title}</span>
    </button>
  );
}`,
        cssOrTailwind:
          "Tailwind included inline: rounded-md, hover/focus-visible states, semantic button usage.",
      },
      riskNotes: [
        "Verify tracking hooks still fire on onSelect.",
        "Confirm no nested button exists in parent component.",
      ],
      confidence: 0.82,
    } satisfies GenerateFixResponse;
  }

  return {
    diagnosis:
      "The primary CTA is not reliably visible on mobile, delaying progression in the main conversion flow.",
    fixPlan: [
      "Pin the primary CTA to a sticky mobile footer.",
      "Ensure safe-area padding and clear contrast.",
      "Keep desktop layout unchanged via responsive classes.",
    ],
    patchedCode: {
      react: `export function CheckoutFooterCTA({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 md:w-auto"
      >
        Continue to Payment
      </button>
    </div>
  );
}`,
      cssOrTailwind:
        "Tailwind included inline: mobile sticky footer + desktop fallback + accessible focus states.",
    },
    riskNotes: [
      "Validate sticky footer does not cover form fields on small devices.",
      "Confirm spacing with iOS safe-area insets if needed.",
    ],
    confidence: 0.8,
  } satisfies GenerateFixResponse;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GenerateFixRequest;

  if (!body.issue || !body.projectId) {
    return NextResponse.json(
      { error: "Missing required fields: projectId and issue" },
      { status: 400 }
    );
  }

  const usageGate = await guardUsage(body.projectId, "generate_fix");
  if (!usageGate.allowed) {
    return NextResponse.json(
      {
        error: "Monthly fix-generation limit reached for this plan.",
        plan: usageGate.plan,
        limit: usageGate.limit,
        used: usageGate.used,
      },
      { status: 402 }
    );
  }

  const raw = await readFile(PREFERENCES_PATH, "utf-8");
  const preferencesData = JSON.parse(raw) as PreferencesFile;

  const projectPreferences =
    preferencesData.projects?.[body.projectId]?.preferences ?? [];

  let baseFix: GenerateFixResponse;
  if (DEMO_MODE) {
    baseFix = getFixForIssue(body.issue);
  } else {
    const fixModel = getModelForAgent("fix", usageGate.plan, body.issue);
    baseFix = await generateFixWithLLM(
      {
        issue: body.issue,
        preferences: projectPreferences,
        componentContext: body.componentContext,
      },
      fixModel
    );
  }
  const personalizedNote =
    usageGate.features.personalization && projectPreferences.length > 0
      ? `Personalized using team preferences: ${projectPreferences
          .slice(0, 2)
          .join("; ")}`
      : undefined;

  await incrementUsage(body.projectId, "generate_fix");

  return NextResponse.json(
    {
      ...baseFix,
      personalizedNote,
    } satisfies GenerateFixResponse,
    { status: 200 }
  );
}
