import { getOpenAIClient, safeParseJson } from "./aiClient";
import type { FeedbackRequest } from "./issueSchema";
import { getSurgicalAssistantSystemContext } from "./surgicalAssistantAgent";

export interface PreferencePayload {
  feedback: FeedbackRequest;
  existingPreferences: string[];
}

function isUpdatedPreferencesPayload(value: unknown): value is { updatedPreferences: string[] } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { updatedPreferences?: unknown };
  return Array.isArray(candidate.updatedPreferences) && candidate.updatedPreferences.every((item) => typeof item === "string");
}

/**
 * Preference Memory Agent
 * Purpose: Build a data moat via team-specific learning.
 * Converts unstructured developer feedback/notes into actionable design and coding rules.
 */
export async function learnFromFeedbackWithLLM(
  payload: PreferencePayload,
  model = "gpt-4o-mini" // Routed model name for future AI SDK integration
): Promise<string[]> {
  const { feedback, existingPreferences } = payload;

  if (!feedback.notes || feedback.notes.trim() === "") {
    return existingPreferences;
  }

  // 1. Construct the prompt
  const roleContext = getSurgicalAssistantSystemContext();
  const systemPrompt = `${roleContext}

You are a Preference Memory Agent for a frontend engineering team.
Your job is to analyze developer feedback on generated UI fixes and extract concrete, reusable coding or design preferences.
Rules:
- Output only clear, actionable rules (e.g., "Always use rounded-md for buttons", "Never use icon-only buttons without aria-labels").
- If the feedback contradicts an existing rule, update the rule.
- Do not output conversational text.
- Return a JSON array of strings representing the updated list of preferences.`;

  const userPrompt = `
Existing Team Preferences:
${existingPreferences.length > 0 ? JSON.stringify(existingPreferences) : "None"}

New Developer Feedback:
Action Taken: ${feedback.fixAccepted ? "Accepted" : "Rejected"} Fix
Edited By User: ${feedback.editedByUser}
Developer Notes: "${feedback.notes}"

Extract any new rules from these notes and merge them with the existing preferences.
Respond ONLY with this exact JSON structure:
{
  "updatedPreferences": ["rule 1", "rule 2"]
}
`;

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
        temperature: 0.1,
      });

      const parsed = safeParseJson<unknown>(response.choices[0]?.message?.content, null);
      if (isUpdatedPreferencesPayload(parsed)) {
        return parsed.updatedPreferences;
      }
    } catch (error) {
      console.error("[Preference Memory Agent] OpenAI call failed, using fallback:", error);
    }
  }

  // ---------------------------------------------------------
  // MVP / FALLBACK BEHAVIOR
  // ---------------------------------------------------------
  console.log(`[Preference Memory Agent] Analyzing developer feedback: "${feedback.notes}"`);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const newPreferences = new Set([...existingPreferences]);
  const notesLower = feedback.notes.toLowerCase();

  // Simulated AI extraction logic
  if (notesLower.includes("sticky") && (notesLower.includes("cta") || notesLower.includes("button"))) {
    newPreferences.add("Use sticky mobile CTA for checkout flows");
  } else if (notesLower.includes("focus") || notesLower.includes("a11y") || notesLower.includes("accessibility")) {
    newPreferences.add("Prefer high-contrast focus-visible states");
  } else if (notesLower.includes("rounded")) {
    newPreferences.add("Prefer rounded-md borders on interactive elements");
  } else if (notesLower.includes("icon")) {
    newPreferences.add("Avoid icon-only buttons; always include text or aria-labels");
  } else {
    // Generic fallback if the mock "AI" doesn't recognize a keyword
    newPreferences.add(`Follow rule: ${feedback.notes.trim()}`);
  }

  return Array.from(newPreferences);
}
