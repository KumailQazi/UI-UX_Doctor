import { getAnthropicClient, getOpenAIClient, isAnthropicModel, safeParseJson } from "./aiClient";
import type { Issue, GenerateFixResponse } from "./issueSchema";
import { FIX_GENERATION_PROMPT } from "./promptTemplates";
import { getUiSurgeonSystemContext } from "./uiSurgeonAgent";

export interface FixPayload {
  issue: Issue;
  preferences: string[];
  componentContext?: {
    framework?: "react";
    styling?: "tailwind" | "css";
    existingCode?: string;
  };
}

function isGenerateFixResponse(value: unknown): value is GenerateFixResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GenerateFixResponse>;
  return (
    typeof candidate.diagnosis === "string" &&
    Array.isArray(candidate.fixPlan) &&
    typeof candidate.patchedCode?.react === "string" &&
    typeof candidate.patchedCode?.cssOrTailwind === "string" &&
    Array.isArray(candidate.riskNotes) &&
    typeof candidate.confidence === "number"
  );
}

/**
 * Frontend Fix Agent
 * Purpose: Produce minimal, production-friendly code fixes.
 * Constraints: Minimal/surgical changes, preserve behavior, enforce accessibility.
 */
export async function generateFixWithLLM(
  payload: FixPayload,
  model = "gpt-4o" // Routed model name for future AI SDK integration
): Promise<GenerateFixResponse> {
  const { issue, preferences, componentContext } = payload;

  // 1. Construct the prompt
  const roleContext = getUiSurgeonSystemContext();
  const systemPrompt = `${roleContext}

${FIX_GENERATION_PROMPT}`;
  const userPrompt = `
We have detected a UI/UX issue:
Type: ${issue.type}
Severity: ${issue.severity}
Summary: ${issue.summary}
Evidence: ${JSON.stringify(issue.evidence)}

Team Preferences (Must Follow):
${preferences.length > 0 ? preferences.join('\n') : 'None specified.'}

Component Context:
${componentContext?.existingCode ? componentContext.existingCode : 'No existing code provided. Generate from scratch.'}

Respond with a JSON object exactly matching this structure:
{
  "diagnosis": "string (Why is it broken?)",
  "fixPlan": ["string", "string"],
  "patchedCode": {
    "react": "string (The fixed React component code)",
    "cssOrTailwind": "string (Any CSS or Tailwind classes used/changed)"
  },
  "riskNotes": ["string", "string"],
  "confidence": number // 0 to 1
}
`;

  if (isAnthropicModel(model)) {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.2,
        });

        const textBlock = response.content.find((block) => block.type === "text");
        const parsed = safeParseJson<unknown>(textBlock?.type === "text" ? textBlock.text : "", null);
        if (isGenerateFixResponse(parsed)) {
          return parsed;
        }
      } catch (error) {
        console.error("[Frontend Fix Agent] Anthropic call failed, using fallback:", error);
      }
    }
  } else {
    const openai = getOpenAIClient();
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2, // Low temp for code generation stability
        });

        const parsed = safeParseJson<unknown>(response.choices[0]?.message?.content, null);
        if (isGenerateFixResponse(parsed)) {
          return parsed;
        }
      } catch (error) {
        console.error("[Frontend Fix Agent] OpenAI call failed, using fallback:", error);
      }
    }
  }

  // ---------------------------------------------------------
  // MVP / FALLBACK BEHAVIOR
  // ---------------------------------------------------------
  console.log(`[Frontend Fix Agent] Simulating AI fix generation for issue ${issue.issueId}...`);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (issue.type === "dead_click") {
    return {
      diagnosis: "The element visually resembles a button but lacks semantic interactivity, causing repeated failed clicks.",
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
        cssOrTailwind: "Tailwind included inline: rounded-md, hover/focus-visible states, semantic button usage.",
      },
      riskNotes: [
        "Verify tracking hooks still fire on onSelect.",
        "Confirm no nested button exists in parent component.",
      ],
      confidence: 0.88,
    };
  }

  // Default fallback for mobile_hidden_cta
  return {
    diagnosis: "The primary CTA is not reliably visible on mobile, delaying progression in the main conversion flow.",
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
      cssOrTailwind: "Tailwind included inline: mobile sticky footer + desktop fallback + accessible focus states.",
    },
    riskNotes: [
      "Validate sticky footer does not cover form fields on small devices.",
      "Confirm spacing with iOS safe-area insets if needed.",
    ],
    confidence: 0.85,
  };
}
