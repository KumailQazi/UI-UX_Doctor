import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/env";
import type { FeedbackRequest } from "@/lib/issueSchema";
import { getModelForAgent } from "@/lib/modelRouter";
import { learnFromFeedback, loadPreferenceMemory, savePreferenceMemory } from "@/lib/agents/integrationEngineerAgent";

interface PreferencesFile {
  projects: Record<
    string,
    {
      preferences: string[];
      feedbackLog: Array<{
        issueId: string;
        fixAccepted: boolean;
        editedByUser: boolean;
        notes?: string;
        createdAt: string;
      }>;
    }
  >;
}

function inferPreferenceFromNotes(notes?: string): string | null {
  if (!notes) {
    return null;
  }

  if (/sticky/i.test(notes) && /cta|button/i.test(notes)) {
    return "Use sticky mobile CTA for checkout";
  }

  if (/focus|keyboard|a11y|accessibility/i.test(notes)) {
    return "Prefer high-contrast focus-visible states";
  }

  return null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as FeedbackRequest;

  if (!body.projectId || !body.issueId) {
    return NextResponse.json(
      { error: "Missing required fields: projectId and issueId" },
      { status: 400 }
    );
  }

  // Load existing preference memory (vector-based)
  const memory = await loadPreferenceMemory(body.projectId);

  // Add feedback log entry
  const updatedMemory = {
    ...memory,
    feedbackLog: [
      ...(memory as unknown as { feedbackLog?: Array<unknown> }).feedbackLog ?? [],
      {
        issueId: body.issueId,
        fixAccepted: body.fixAccepted,
        editedByUser: body.editedByUser,
        notes: body.notes,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  let newPreferences: string[] = [];

  if (body.notes) {
    if (DEMO_MODE) {
      const inferred = inferPreferenceFromNotes(body.notes);
      if (body.fixAccepted && inferred) {
        const existing = new Set(updatedMemory.rules);
        existing.add(inferred);
        newPreferences = [...existing];
        updatedMemory.rules = newPreferences;
      }
    } else {
      // Use Integration Engineer Agent with vector-based learning
      const preferenceModel = getModelForAgent("integration");
      const learnedMemory = await learnFromFeedback(body, updatedMemory);
      newPreferences = learnedMemory.rules;
    }
  }

  await savePreferenceMemory(updatedMemory);

  // Also update legacy file for backwards compatibility
  const filePath = path.join(process.cwd(), "data", "preferences.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    const legacyData = JSON.parse(raw) as PreferencesFile;
    if (!legacyData.projects[body.projectId]) {
      legacyData.projects[body.projectId] = { preferences: [], feedbackLog: [] };
    }
    legacyData.projects[body.projectId].preferences = newPreferences.length > 0
      ? newPreferences
      : legacyData.projects[body.projectId].preferences;
    legacyData.projects[body.projectId].feedbackLog.push({
      issueId: body.issueId,
      fixAccepted: body.fixAccepted,
      editedByUser: body.editedByUser,
      notes: body.notes,
      createdAt: new Date().toISOString(),
    });
    await writeFile(filePath, JSON.stringify(legacyData, null, 2), "utf-8");
  } catch {
    // Legacy file might not exist, that's ok
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Feedback stored and preferences updated",
      projectId: body.projectId,
      preferencesCount: newPreferences.length,
      learnedFrom: body.notes ? "feedback notes" : undefined,
    },
    { status: 200 }
  );
}
