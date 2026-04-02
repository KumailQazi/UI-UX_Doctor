import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/env";
import type { FeedbackRequest } from "@/lib/issueSchema";
import { getModelForAgent } from "@/lib/modelRouter";
import { learnFromFeedbackWithLLM } from "@/lib/preferenceMemoryAgent";

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

  const filePath = path.join(process.cwd(), "data", "preferences.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as PreferencesFile;

  if (!data.projects[body.projectId]) {
    data.projects[body.projectId] = { preferences: [], feedbackLog: [] };
  }

  data.projects[body.projectId].feedbackLog.push({
    issueId: body.issueId,
    fixAccepted: body.fixAccepted,
    editedByUser: body.editedByUser,
    notes: body.notes,
    createdAt: new Date().toISOString(),
  });

  if (body.notes) {
    if (DEMO_MODE) {
      const inferred = inferPreferenceFromNotes(body.notes);
      if (body.fixAccepted && inferred) {
        const existing = new Set(data.projects[body.projectId].preferences);
        existing.add(inferred);
        data.projects[body.projectId].preferences = [...existing];
      }
    } else {
      const preferenceModel = getModelForAgent("preference");
      data.projects[body.projectId].preferences = await learnFromFeedbackWithLLM(
        {
          feedback: body,
          existingPreferences: data.projects[body.projectId].preferences,
        },
        preferenceModel
      );
    }
  }

  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

  return NextResponse.json(
    {
      ok: true,
      message: "Feedback stored",
      projectId: body.projectId,
    },
    { status: 200 }
  );
}
