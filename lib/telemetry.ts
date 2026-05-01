import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { TelemetryEvent, AgentPerformance } from "./issueSchema";
import { RUNTIME_ENV } from "./env";

/**
 * Telemetry System
 * Collects metrics from every agent interaction for Meta-Learner analysis
 */

const TELEMETRY_DIR = path.join(RUNTIME_ENV.dataDir, "telemetry");
const EVENTS_FILE = path.join(TELEMETRY_DIR, "events.jsonl");
const AGENT_PERFORMANCE_FILE = path.join(TELEMETRY_DIR, "agent-performance.json");

// In-memory buffer for batch writes
const eventBuffer: TelemetryEvent[] = [];
const BUFFER_FLUSH_SIZE = 10;
const BUFFER_FLUSH_MS = 5000;

/**
 * Hash input for consistent tracking without storing full content
 */
export function hashInput(input: unknown): string {
  const str = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha256").update(str).digest("hex").substring(0, 16);
}

/**
 * Record a telemetry event
 */
export async function recordTelemetry(
  event: Omit<TelemetryEvent, "eventId" | "timestamp" | "inputHash" | "outputHash"> &
    Partial<Pick<TelemetryEvent, "inputHash" | "outputHash">>
): Promise<void> {
  const fullEvent: TelemetryEvent = {
    ...event,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    inputHash: event.inputHash ?? hashInput(event.agentId + event.taskType),
    outputHash: event.outputHash ?? "pending",
  };

  eventBuffer.push(fullEvent);

  // Flush if buffer is full
  if (eventBuffer.length >= BUFFER_FLUSH_SIZE) {
    await flushTelemetryBuffer();
  }
}

/**
 * Flush buffered events to disk
 */
export async function flushTelemetryBuffer(): Promise<void> {
  if (eventBuffer.length === 0) return;

  try {
    await mkdir(TELEMETRY_DIR, { recursive: true });

    const lines = eventBuffer.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await writeFile(EVENTS_FILE, lines, { flag: "a" });

    // Clear buffer
    eventBuffer.length = 0;
  } catch (error) {
    console.error("[Telemetry] Failed to flush buffer:", error);
  }
}

// Auto-flush interval
setInterval(flushTelemetryBuffer, BUFFER_FLUSH_MS);

/**
 * Query telemetry events with filters
 */
export async function queryTelemetry(filters: {
  agentId?: string;
  taskType?: string;
  projectId?: string;
  issueId?: string;
  since?: string;
  until?: string;
  userFeedback?: "accepted" | "rejected" | "modified";
  promptVersion?: string;
  limit?: number;
}): Promise<TelemetryEvent[]> {
  try {
    const content = await readFile(EVENTS_FILE, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    const events: TelemetryEvent[] = lines
      .map((line) => JSON.parse(line) as TelemetryEvent)
      .filter((e) => {
        if (filters.agentId && e.agentId !== filters.agentId) return false;
        if (filters.taskType && e.taskType !== filters.taskType) return false;
        if (filters.projectId && e.projectId !== filters.projectId) return false;
        if (filters.issueId && e.issueId !== filters.issueId) return false;
        if (filters.userFeedback && e.userFeedback !== filters.userFeedback)
          return false;
        if (filters.promptVersion && e.promptVersion !== filters.promptVersion)
          return false;
        if (filters.since && e.timestamp < filters.since) return false;
        if (filters.until && e.timestamp > filters.until) return false;
        return true;
      });

    // Sort by timestamp desc
    events.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return filters.limit ? events.slice(0, filters.limit) : events;
  } catch {
    return [];
  }
}

/**
 * Calculate agent performance metrics
 */
export async function calculateAgentPerformance(
  agentId: string,
  days: number = 7
): Promise<AgentPerformance> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await queryTelemetry({
    agentId,
    since: since.toISOString(),
  });

  const total = events.length;
  if (total === 0) {
    return {
      agentId,
      tasksCompleted: 0,
      acceptanceRate: 0,
      avgLatencyMs: 0,
      errorRate: 0,
      lastEvaluatedAt: new Date().toISOString(),
    };
  }

  const withFeedback = events.filter((e) => e.userFeedback);
  const accepted = withFeedback.filter((e) => e.userFeedback === "accepted");
  const errors = events.filter((e) => e.error);

  const avgLatency =
    events.reduce((sum, e) => sum + e.latencyMs, 0) / total;

  return {
    agentId,
    tasksCompleted: total,
    acceptanceRate:
      withFeedback.length > 0 ? accepted.length / withFeedback.length : 0,
    avgLatencyMs: Math.round(avgLatency),
    errorRate: errors.length / total,
    lastEvaluatedAt: new Date().toISOString(),
  };
}

/**
 * Get performance for all agents
 */
export async function getAllAgentPerformance(
  days: number = 7
): Promise<AgentPerformance[]> {
  // Get unique agent IDs from telemetry
  try {
    const content = await readFile(EVENTS_FILE, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    const agentIds = new Set<string>();

    for (const line of lines) {
      const event = JSON.parse(line) as TelemetryEvent;
      agentIds.add(event.agentId);
    }

    const performances: AgentPerformance[] = [];
    for (const agentId of agentIds) {
      performances.push(await calculateAgentPerformance(agentId, days));
    }

    return performances;
  } catch {
    return [];
  }
}

/**
 * Store agent performance snapshot
 */
export async function storeAgentPerformance(
  performance: AgentPerformance
): Promise<void> {
  try {
    await mkdir(TELEMETRY_DIR, { recursive: true });

    let allPerformance: AgentPerformance[] = [];
    try {
      const content = await readFile(AGENT_PERFORMANCE_FILE, "utf-8");
      allPerformance = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    // Update or append
    const idx = allPerformance.findIndex(
      (p) => p.agentId === performance.agentId
    );
    if (idx >= 0) {
      allPerformance[idx] = performance;
    } else {
      allPerformance.push(performance);
    }

    await writeFile(
      AGENT_PERFORMANCE_FILE,
      JSON.stringify(allPerformance, null, 2)
    );
  } catch (error) {
    console.error("[Telemetry] Failed to store performance:", error);
  }
}

/**
 * Get failure examples for a specific issue type (for Meta-Learner prompt evolution)
 */
export async function getFailureExamples(
  issueType: string,
  limit: number = 20
): Promise<TelemetryEvent[]> {
  return queryTelemetry({
    taskType: "generate_fix",
    userFeedback: "rejected",
    limit,
  });
}

/**
 * Get success examples for a specific issue type (for Meta-Learner prompt evolution)
 */
export async function getSuccessExamples(
  issueType: string,
  limit: number = 20
): Promise<TelemetryEvent[]> {
  return queryTelemetry({
    taskType: "generate_fix",
    userFeedback: "accepted",
    limit,
  });
}

/**
 * Calculate acceptance rate for a specific issue type
 */
export async function calculateIssueTypeAcceptanceRate(
  issueType: string,
  days: number = 7
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await queryTelemetry({
    taskType: "generate_fix",
    since: since.toISOString(),
  });

  const withFeedback = events.filter((e) => e.userFeedback);
  if (withFeedback.length === 0) return 0;

  const accepted = withFeedback.filter((e) => e.userFeedback === "accepted");
  return accepted.length / withFeedback.length;
}

// Graceful shutdown handler
process.on("beforeExit", async () => {
  await flushTelemetryBuffer();
});

process.on("SIGINT", async () => {
  await flushTelemetryBuffer();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await flushTelemetryBuffer();
  process.exit(0);
});
