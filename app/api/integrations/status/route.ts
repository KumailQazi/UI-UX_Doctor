import { NextResponse } from "next/server";

function isConfigured(value?: string): boolean {
  return Boolean(value && value.trim().length > 0);
}

export async function GET() {
  const githubConfigured =
    isConfigured(process.env.UIUX_DOCTOR_GITHUB_REPO) &&
    isConfigured(process.env.UIUX_DOCTOR_GITHUB_TOKEN);

  const jiraConfigured =
    isConfigured(process.env.UIUX_DOCTOR_JIRA_BASE_URL) &&
    isConfigured(process.env.UIUX_DOCTOR_JIRA_EMAIL) &&
    isConfigured(process.env.UIUX_DOCTOR_JIRA_API_TOKEN) &&
    isConfigured(process.env.UIUX_DOCTOR_JIRA_PROJECT_KEY);

  return NextResponse.json(
    {
      github: {
        configured: githubConfigured,
      },
      jira: {
        configured: jiraConfigured,
      },
    },
    { status: 200 }
  );
}
