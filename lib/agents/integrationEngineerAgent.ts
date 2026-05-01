import "server-only";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Issue, FeedbackRequest, PreferenceMemory } from "../issueSchema";
import { getAgentRole } from "../agentRoles";
import { recordTelemetry } from "../telemetry";
import { RUNTIME_ENV } from "../env";

/**
 * Integration Engineer Agent (Evolved Surgical Assistant)
 * Codename: surgical-assistant (integration-engineer)
 * Model: Claude Sonnet / GPT-4o-mini
 * Personality: Systems thinker. Makes APIs talk.
 *
 * New Capabilities:
 * - Bidirectional sync with Jira/Linear/GitHub
 * - Figma integration for design tokens
 * - Storybook integration for component context
 * - Slack/Teams notifications
 * - Vector-based preference memory
 */

export const INTEGRATION_ENGINEER_VERSION = "2.0.0";

const PREFERENCES_DIR = path.join(RUNTIME_ENV.dataDir, "preferences");

/**
 * Get Integration Engineer system context
 */
export function getIntegrationEngineerSystemContext(): string {
  return getAgentRole("surgical-assistant").systemContext;
}

// Jira Integration
interface JiraConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  projectKey: string;
}

interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  issueType: string;
  priority: string;
}

/**
 * Create Jira ticket from UI/UX issue
 */
export async function createJiraTicket(
  issue: Issue,
  config: JiraConfig
): Promise<{ success: boolean; ticketKey?: string; error?: string }> {
  try {
    const response = await fetch(`${config.baseUrl}/rest/api/2/issue`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.username}:${config.apiToken}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: config.projectKey },
          summary: `[UI-UX Doctor] ${issue.summary}`,
          description: `Type: ${issue.type}\nSeverity: ${issue.severity}\nConfidence: ${issue.confidence}\n\nWhy it matters: ${issue.whyItMatters}\n\nEvidence:\n${issue.evidence.map((e) => `- ${e.timestampSec}s: ${e.note}`).join("\n")}`,
          issuetype: { name: "Bug" },
          priority: { name: issue.severity === "high" ? "High" : "Medium" },
          labels: ["ui-ux-doctor", issue.type],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, ticketKey: data.key };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync issue status from Jira
 */
export async function syncJiraStatus(
  ticketKey: string,
  config: JiraConfig
): Promise<{ status: string; updated: boolean }> {
  try {
    const response = await fetch(
      `${config.baseUrl}/rest/api/2/issue/${ticketKey}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${config.username}:${config.apiToken}`
          ).toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      return { status: "unknown", updated: false };
    }

    const data = await response.json();
    return { status: data.fields.status.name, updated: true };
  } catch {
    return { status: "unknown", updated: false };
  }
}

// Slack Integration
interface SlackConfig {
  webhookUrl: string;
  channel?: string;
}

/**
 * Send Slack notification for high-severity issue
 */
export async function sendSlackNotification(
  issue: Issue,
  config: SlackConfig,
  options?: { dashboardUrl?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      channel: config.channel,
      username: "UI/UX Doctor",
      icon_emoji: ":medical_symbol:",
      attachments: [
        {
          color: issue.severity === "high" ? "danger" : "warning",
          title: `High Severity UI Issue Detected: ${issue.type}`,
          text: issue.summary,
          fields: [
            {
              title: "Severity",
              value: issue.severity,
              short: true,
            },
            {
              title: "Confidence",
              value: `${(issue.confidence * 100).toFixed(0)}%`,
              short: true,
            },
            {
              title: "Why it matters",
              value: issue.whyItMatters,
              short: false,
            },
          ],
          footer: "UI/UX Doctor",
          actions: options?.dashboardUrl
            ? [
                {
                  type: "button",
                  text: "View in Dashboard",
                  url: options.dashboardUrl,
                },
              ]
            : undefined,
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Figma Integration
interface FigmaConfig {
  accessToken: string;
  fileKey: string;
}

interface FigmaDesignToken {
  name: string;
  value: string;
  type: "color" | "spacing" | "typography";
}

/**
 * Fetch design tokens from Figma Variables
 */
export async function fetchFigmaDesignTokens(
  config: FigmaConfig
): Promise<{ success: boolean; tokens?: FigmaDesignToken[]; error?: string }> {
  try {
    const response = await fetch(
      `https://api.figma.com/v1/files/${config.fileKey}/variables/local`,
      {
        headers: {
          "X-Figma-Token": config.accessToken,
        },
      }
    );

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    const data = await response.json();

    // Parse Figma variables into design tokens
    const tokens: FigmaDesignToken[] = [];

    // Would parse actual Figma response structure
    // For MVP, return empty list (implement when Figma API is available)

    return { success: true, tokens };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Vector-based Preference Memory

/**
 * Generate simple embedding from text (MVP implementation)
 * In production, use OpenAI embeddings or similar
 */
function generateEmbedding(text: string): number[] {
  // Simple hash-based embedding for MVP
  // In production: use text-embedding-3-small or similar
  const hash = text.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);

  // Generate 10-dim vector from hash
  const embedding: number[] = [];
  let h = Math.abs(hash);
  for (let i = 0; i < 10; i++) {
    h = (h * 9301 + 49297) % 233280;
    embedding.push(h / 233280);
  }

  return embedding;
}

/**
 * Calculate cosine similarity between embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load preference memory for a project
 */
export async function loadPreferenceMemory(
  projectId: string
): Promise<PreferenceMemory> {
  try {
    const filePath = path.join(PREFERENCES_DIR, `${projectId}-memory.json`);
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as PreferenceMemory;
  } catch {
    // Return default empty memory
    return {
      projectId,
      embeddings: [],
      rules: [],
      acceptedFixes: [],
      rejectedFixes: [],
      componentPatterns: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Save preference memory for a project
 */
export async function savePreferenceMemory(
  memory: PreferenceMemory
): Promise<void> {
  await mkdir(PREFERENCES_DIR, { recursive: true });
  const filePath = path.join(PREFERENCES_DIR, `${memory.projectId}-memory.json`);
  await writeFile(filePath, JSON.stringify(memory, null, 2));
}

/**
 * Learn from feedback and update preference memory
 */
export async function learnFromFeedback(
  feedback: FeedbackRequest,
  existingMemory?: PreferenceMemory
): Promise<PreferenceMemory> {
  const startTime = Date.now();
  const memory =
    existingMemory ?? (await loadPreferenceMemory(feedback.projectId));

  if (!feedback.notes || feedback.notes.trim() === "") {
    return memory;
  }

  // Extract rules from feedback
  const newRules: string[] = [];
  const notesLower = feedback.notes.toLowerCase();

  if (notesLower.includes("sticky") && (notesLower.includes("cta") || notesLower.includes("button"))) {
    newRules.push("Use sticky mobile CTA for checkout flows");
  }
  if (notesLower.includes("focus") || notesLower.includes("a11y") || notesLower.includes("accessibility")) {
    newRules.push("Prefer high-contrast focus-visible states");
  }
  if (notesLower.includes("rounded")) {
    newRules.push("Prefer rounded-md borders on interactive elements");
  }
  if (notesLower.includes("icon")) {
    newRules.push("Avoid icon-only buttons; always include text or aria-labels");
  }

  // Add generic rule if no specific patterns matched
  if (newRules.length === 0) {
    newRules.push(`Developer preference: ${feedback.notes.trim()}`);
  }

  // Update memory
  for (const rule of newRules) {
    if (!memory.rules.includes(rule)) {
      memory.rules.push(rule);
    }
  }

  // Track fix acceptance/rejection
  if (feedback.issueId) {
    if (feedback.fixAccepted) {
      if (!memory.acceptedFixes.includes(feedback.issueId)) {
        memory.acceptedFixes.push(feedback.issueId);
      }
    } else {
      if (!memory.rejectedFixes.includes(feedback.issueId)) {
        memory.rejectedFixes.push(feedback.issueId);
      }
    }
  }

  // Update embeddings
  const textToEmbed = feedback.notes + " " + newRules.join(" ");
  const newEmbedding = generateEmbedding(textToEmbed);
  memory.embeddings = newEmbedding;

  memory.updatedAt = new Date().toISOString();

  await savePreferenceMemory(memory);

  // Record telemetry
  await recordTelemetry({
    agentId: "surgical-assistant",
    taskType: "feedback",
    projectId: feedback.projectId,
    issueId: feedback.issueId,
    inputHash: feedback.notes,
    outputHash: `${newRules.length}-${memory.rules.length}`,
    latencyMs: Date.now() - startTime,
    promptVersion: INTEGRATION_ENGINEER_VERSION,
    modelUsed: "rule-based",
    userFeedback: feedback.fixAccepted ? "accepted" : "rejected",
  });

  return memory;
}

/**
 * Find similar preferences using vector similarity
 */
export async function findSimilarPreferences(
  projectId: string,
  queryText: string,
  topK: number = 5
): Promise<string[]> {
  const memory = await loadPreferenceMemory(projectId);
  const queryEmbedding = generateEmbedding(queryText);

  // Score rules by similarity
  const scoredRules = memory.rules.map((rule) => {
    const ruleEmbedding = generateEmbedding(rule);
    const similarity = cosineSimilarity(queryEmbedding, ruleEmbedding);
    return { rule, similarity };
  });

  // Return top K
  return scoredRules
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map((r) => r.rule);
}

/**
 * Main integration entry point
 */
export async function processIntegration(
  action: {
    type: "jira_create" | "jira_sync" | "slack_notify" | "figma_tokens" | "learn_preference" | "get_preferences";
    payload: unknown;
    config?: unknown;
  },
  options?: { projectId: string }
): Promise<unknown> {
  const startTime = Date.now();
  let result: unknown;

  switch (action.type) {
    case "jira_create":
      result = await createJiraTicket(
        action.payload as Issue,
        action.config as JiraConfig
      );
      break;
    case "jira_sync":
      result = await syncJiraStatus(
        action.payload as string,
        action.config as JiraConfig
      );
      break;
    case "slack_notify":
      result = await sendSlackNotification(
        action.payload as Issue,
        action.config as SlackConfig
      );
      break;
    case "figma_tokens":
      result = await fetchFigmaDesignTokens(action.config as FigmaConfig);
      break;
    case "learn_preference":
      result = await learnFromFeedback(
        action.payload as FeedbackRequest,
        options?.projectId
          ? await loadPreferenceMemory(options.projectId)
          : undefined
      );
      break;
    case "get_preferences":
      result = await loadPreferenceMemory(
        (action.payload as { projectId: string }).projectId
      );
      break;
    default:
      result = { success: false, error: "Unknown action type" };
  }

  await recordTelemetry({
    agentId: "surgical-assistant",
    taskType: "validate",
    projectId: options?.projectId ?? "system",
    inputHash: action.type,
    outputHash: JSON.stringify(result).slice(0, 50),
    latencyMs: Date.now() - startTime,
    promptVersion: INTEGRATION_ENGINEER_VERSION,
    modelUsed: "rule-based",
  });

  return result;
}

/**
 * Legacy support for getSurgicalAssistantSystemContext
 */
export function getSurgicalAssistantSystemContext(): string {
  return getIntegrationEngineerSystemContext();
}
