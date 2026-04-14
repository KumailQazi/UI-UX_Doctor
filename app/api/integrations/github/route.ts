import { NextResponse } from "next/server";
import type { GenerateFixResponse, Issue } from "@/lib/issueSchema";

interface CreateGithubIssueRequest {
  projectId: string;
  jobId?: string;
  issue: Issue;
  fix: GenerateFixResponse;
}

interface GithubIssueApiResponse {
  html_url: string;
  number: number;
}

function buildIssueBody(payload: CreateGithubIssueRequest): string {
  const { projectId, jobId, issue, fix } = payload;

  return [
    `## UI/UX Doctor Prescription`,
    ``,
    `- **Project**: ${projectId}`,
    `- **Job ID**: ${jobId ?? "N/A"}`,
    `- **Issue ID**: ${issue.issueId}`,
    `- **Issue Type**: ${issue.type}`,
    `- **Severity**: ${issue.severity}`,
    `- **Confidence**: ${Math.round(issue.confidence * 100)}%`,
    ``,
    `### Summary`,
    issue.summary,
    ``,
    `### Why it matters`,
    issue.whyItMatters,
    ``,
    `### Diagnosis`,
    fix.diagnosis,
    ``,
    `### Fix plan`,
    ...fix.fixPlan.map((step, index) => `${index + 1}. ${step}`),
    ``,
    `### React patch`,
    "```tsx",
    fix.patchedCode.react,
    "```",
    ``,
    `### Tailwind/CSS patch`,
    "```tsx",
    fix.patchedCode.cssOrTailwind,
    "```",
    ``,
    `### Risk notes`,
    ...fix.riskNotes.map((note) => `- ${note}`),
  ].join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<CreateGithubIssueRequest>;

  if (!body.projectId || !body.issue || !body.fix) {
    return NextResponse.json(
      { error: "Missing required fields: projectId, issue, fix" },
      { status: 400 }
    );
  }

  const repo = process.env.UIUX_DOCTOR_GITHUB_REPO?.trim();
  const token = process.env.UIUX_DOCTOR_GITHUB_TOKEN?.trim();
  const labelRaw = process.env.UIUX_DOCTOR_GITHUB_LABELS?.trim();

  if (!repo || !token) {
    return NextResponse.json(
      {
        error:
          "GitHub integration is not configured. Set UIUX_DOCTOR_GITHUB_REPO and UIUX_DOCTOR_GITHUB_TOKEN.",
      },
      { status: 503 }
    );
  }

  const labels = labelRaw
    ? labelRaw
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    : ["ui-ux-doctor", "ux-friction"];

  const title = `[UI/UX Doctor] ${body.issue.severity.toUpperCase()} - ${body.issue.summary}`;
  const issueBody = buildIssueBody(body as CreateGithubIssueRequest);

  const githubResponse = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "ui-ux-doctor",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title,
      body: issueBody,
      labels,
    }),
  });

  if (!githubResponse.ok) {
    const errorText = await githubResponse.text();
    return NextResponse.json(
      {
        error: "Failed to create GitHub issue",
        details: errorText,
      },
      { status: 502 }
    );
  }

  const created = (await githubResponse.json()) as GithubIssueApiResponse;

  return NextResponse.json(
    {
      ok: true,
      message: "GitHub issue created",
      repo,
      issueNumber: created.number,
      issueUrl: created.html_url,
    },
    { status: 200 }
  );
}
