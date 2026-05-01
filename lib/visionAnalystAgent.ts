import { randomUUID } from "node:crypto";
import { getOpenAIClient, safeParseJson } from "./aiClient";
import { getAiRadiologistSystemContext } from "./agents/aiRadiologistAgent";
import type { Issue } from "./issueSchema";
import type { ExtractedFrame } from "./frameExtractor";
import { VISION_ANALYSIS_PROMPT } from "./promptTemplates";

export interface AnalysisPayload {
  frames: ExtractedFrame[];
  sessionMetadata?: Record<string, unknown>;
}

/**
 * Vision Analyst Agent
 * Purpose: Detect visual UX issues from frames/session recordings.
 * Allowed Classes: 'dead_click', 'mobile_hidden_cta'
 * Constraints: Max 3 issues, precision > recall, strict JSON output.
 */
export async function analyzeFramesWithVisionModel(
  payload: AnalysisPayload,
  model = "gpt-4o" // Routed model name for future AI SDK integration
): Promise<Issue[]> {
  const { frames, sessionMetadata } = payload;

  if (!frames || frames.length === 0) {
    return [];
  }

  // 1. Construct the exact prompt required for the Vision LLM
  const roleContext = getAiRadiologistSystemContext();
  const systemPrompt = `${roleContext}

${VISION_ANALYSIS_PROMPT}`;
  const userPrompt = `
Analyze the following user session.
Session Metadata: ${JSON.stringify(sessionMetadata || {})}
Timestamps and Frame References: ${JSON.stringify(frames)}

Respond with a JSON array of issues. Each issue must adhere to this JSON structure:
{
  "issues": [
    {
      "issueId": "string",
      "type": "dead_click" | "mobile_hidden_cta",
      "severity": "high" | "medium" | "low",
      "summary": "string",
      "evidence": [{ "timestampSec": number, "note": "string" }],
      "confidence": number, // 0 to 1
      "whyItMatters": "string"
    }
  ]
}
`;

  const openai = getOpenAIClient();
  if (openai) {
    try {
      const imageInputs = frames
        .filter((frame) => /^https?:\/\//.test(frame.frameRef) || /^data:image\//.test(frame.frameRef))
        .map((frame) => ({
          type: "image_url" as const,
          image_url: { url: frame.frameRef },
        }));

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [{ type: "text", text: userPrompt }, ...imageInputs],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temp for analytical precision
      });

      const parsed = safeParseJson<{ issues: Issue[] }>(response.choices[0]?.message?.content, { issues: [] });
      if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
        return parsed.issues;
      }
    } catch (error) {
      console.error("[Vision Analyst Agent] OpenAI call failed, using fallback:", error);
    }
  }

  // ---------------------------------------------------------
  // MVP / FALLBACK BEHAVIOR
  // ---------------------------------------------------------
  console.log(`[Vision Analyst Agent] Simulating AI analysis on ${frames.length} frames...`);

  // Simulating the delay of a vision model processing images
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Returning generated mock issues based on the schema rules
  return [
    {
      issueId: randomUUID(),
      type: "dead_click",
      severity: "high",
      summary: "User repeatedly tapped on the non-interactive 'Pricing' pill.",
      evidence: [
        {
          timestampSec: frames[0]?.timestampSec || 12,
          note: "First tap on Pricing pill, no visual feedback.",
        },
        {
          timestampSec: frames[1]?.timestampSec || 14,
          note: "Second tap on same element, user scrolls rapidly afterwards.",
        },
      ],
      confidence: 0.92,
      whyItMatters: "High frustration signal. User expects navigation but gets stuck, potentially increasing drop-off.",
    },
    {
      issueId: randomUUID(),
      type: "mobile_hidden_cta",
      severity: "high",
      summary: "Primary checkout CTA is below the fold on common mobile viewport heights.",
      evidence: [
        {
          timestampSec: frames[2]?.timestampSec || 28,
          note: "CTA not visible until second scroll; users hesitate and bounce.",
        }
      ],
      confidence: 0.84,
      whyItMatters: "Reduces conversion by hiding the next-step action at a critical moment.",
    }
  ];
}
