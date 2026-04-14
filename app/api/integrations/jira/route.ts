import { NextResponse } from "next/server";
import type { GenerateFixResponse, Issue } from "@/lib/issueSchema";

interface CreateJiraIssueRequest {
  projectId: string;
  jobId?: string;
  issue: Issue;
  fix: GenerateFixResponse;
}

interface JiraIssueApiResponse {
  key: string;
}

function buildJiraDescription(payload: CreateJiraIssueRequest): string {
  const { projectId, jobId, issue, fix } = payload;

  return [
    "h2. UI/UX Doctor Prescription",
    "",
    `*Project:* ${projectId}`,
    `*Job ID:* ${jobId ?? "N/A"}`,
    `*Issue ID:* ${issue.issueId}`,
    `*Issue Type:* ${issue.type}`,
    `*Severity:* ${issue.severity}`,
    `*Confidence:* ${Math.round(issue.confidence * 100)}%`,
    "",
    "h3. Summary",
    issue.summary,
    "",
    "h3. Why it matters",
    issue.whyItMatters,
    "",
    "h3. Diagnosis",
    fix.diagnosis,
    "",
    "h3. Fix plan",
    ...fix.fixPlan.map((step, index) => `# ${index + 1}. ${step}`),
    "",
    "h3. React patch",
    "{code:tsx}",
    fix.patchedCode.react,
    "{code}",
    "",
    "h3. Tailwind/CSS patch",
    "{code:tsx}",
    fix.patchedCode.cssOrTailwind,
    "{code}",
    "",
    "h3. Risk notes",
    ...fix.riskNotes.map((note) => `* ${note}`),
  ].join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<CreateJiraIssueRequest>;

  if (!body.projectId || !body.issue || !body.fix) {
    return NextResponse.json(
      { error: "Missing required fields: projectId, issue, fix" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.UIUX_DOCTOR_JIRA_BASE_URL?.trim().replace(/\/$/, "");
  const email = process.env.UIUX_DOCTOR_JIRA_EMAIL?.trim();
  const apiToken = process.env.UIUX_DOCTOR_JIRA_API_TOKEN?.trim();
  const projectKey = process.env.UIUX_DOCTOR_JIRA_PROJECT_KEY?.trim();
  const issueTypeName = process.env.UIUX_DOCTOR_JIRA_ISSUE_TYPE?.trim() || "Task";
  const labelsRaw = process.env.UIUX_DOCTOR_JIRA_LABELS?.trim();

  if (!baseUrl || !email || !apiToken || !projectKey) {
    return NextResponse.json(
      {
        error:
          "Jira integration is not configured. Set UIUX_DOCTOR_JIRA_BASE_URL, UIUX_DOCTOR_JIRA_EMAIL, UIUX_DOCTOR_JIRA_API_TOKEN, and UIUX_DOCTOR_JIRA_PROJECT_KEY.",
      },
      { status: 503 }
    );
  }

  const labels = labelsRaw
    ? labelsRaw
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    : ["ui-ux-doctor", "ux-friction"];

  const summary = `[UI/UX Doctor] ${body.issue.severity.toUpperCase()} - ${body.issue.summary}`;
  const description = buildJiraDescription(body as CreateJiraIssueRequest);
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const jiraResponse = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        description,
        issuetype: { name: issueTypeName },
        labels,
      },
    }),
  });

  if (!jiraResponse.ok) {
    const errorText = await jiraResponse.text();
    return NextResponse.json(
      {
        error: "Failed to create Jira issue",
        details: errorText,
      },
      { status: 502 }
    );
  }

  const created = (await jiraResponse.json()) as JiraIssueApiResponse;
  const issueUrl = `${baseUrl}/browse/${created.key}`;

  return NextResponse.json(
    {
      ok: true,
      message: "Jira issue created",
      issueKey: created.key,
      issueUrl,
    },
    { status: 200 }
  );
}
