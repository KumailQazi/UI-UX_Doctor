import "server-only";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { TelemetryEvent, AgentPerformance } from "../issueSchema";
import { getAgentRole } from "../agentRoles";
import { registerIssueType, type IssueTypeDefinition } from "../issueRegistry";
import {
  queryTelemetry,
  calculateAgentPerformance,
  getAllAgentPerformance,
  storeAgentPerformance,
  getFailureExamples,
  getSuccessExamples,
} from "../telemetry";
import { RUNTIME_ENV } from "../env";

/**
 * Meta-Learner Agent
 * Codename: meta-learner
 * Model: Claude Opus 4 / GPT-4o
 * Personality: Scientist. Runs experiments on the other agents.
 *
 * Responsibilities:
 * - Collect metrics from every agent interaction
 * - Identify failure modes and root causes
 * - Rewrite prompts based on false-positive rates
 * - A/B test prompts on 10% of traffic
 * - Update issue taxonomy by discovering new patterns
 * - Report improvement metrics to Narrative Engine
 */

export const META_LEARNER_VERSION = "1.0.0";

const META_LEARNER_DIR = path.join(RUNTIME_ENV.dataDir, "meta-learner");
const PROMPT_VERSIONS_FILE = path.join(META_LEARNER_DIR, "prompt-versions.json");
const A_B_TESTS_FILE = path.join(META_LEARNER_DIR, "ab-tests.json");
const DISCOVERED_ISSUES_FILE = path.join(META_LEARNER_DIR, "discovered-issues.json");

// Performance thresholds
const ACCEPTANCE_RATE_THRESHOLD = 0.75;
const FALSE_POSITIVE_THRESHOLD = 0.1;
const PROMPT_EVOLUTION_MIN_SAMPLES = 20;

interface PromptVersion {
  versionId: string;
  agentId: string;
  promptType: "vision" | "fix" | "preference";
  content: string;
  createdAt: string;
  metrics: {
    samples: number;
    acceptanceRate: number;
    avgLatencyMs: number;
  };
  status: "active" | "testing" | "retired";
}

interface ABTest {
  testId: string;
  agentId: string;
  promptA: string;
  promptB: string;
  trafficSplit: number; // 0.1 = 10% to B
  startDate: string;
  endDate?: string;
  results?: {
    samplesA: number;
    samplesB: number;
    acceptanceRateA: number;
    acceptanceRateB: number;
    winner: "A" | "B" | "inconclusive";
  };
  status: "running" | "completed" | "cancelled";
}

interface DiscoveredIssueType {
  typeId: string;
  discoveredAt: string;
  detectionPattern: string;
  sampleSessions: string[];
  confidence: number;
  registered: boolean;
}

/**
 * Get Meta-Learner system context
 */
export function getMetaLearnerSystemContext(): string {
  return getAgentRole("meta-learner").systemContext;
}

/**
 * Analyze agent performance and identify improvement opportunities
 */
export async function analyzeAgentPerformance(
  days: number = 7
): Promise<{
  underperforming: AgentPerformance[];
  recommendations: Array<{
    agentId: string;
    issue: string;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }>;
}> {
  const performances = await getAllAgentPerformance(days);
  const underperforming: AgentPerformance[] = [];
  const recommendations: Array<{
    agentId: string;
    issue: string;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }> = [];

  for (const perf of performances) {
    // Check acceptance rate
    if (perf.acceptanceRate < ACCEPTANCE_RATE_THRESHOLD) {
      underperforming.push(perf);
      recommendations.push({
        agentId: perf.agentId,
        issue: `Acceptance rate ${(perf.acceptanceRate * 100).toFixed(1)}% below threshold ${(ACCEPTANCE_RATE_THRESHOLD * 100).toFixed(0)}%`,
        recommendation: `Escalate ${perf.agentId} to higher-quality model or evolve prompt`,
        priority: "high",
      });
    }

    // Check error rate
    if (perf.errorRate > 0.05) {
      recommendations.push({
        agentId: perf.agentId,
        issue: `Error rate ${(perf.errorRate * 100).toFixed(1)}% too high`,
        recommendation: `Review error logs and add validation gates`,
        priority: "high",
      });
    }

    // Check latency
    if (perf.avgLatencyMs > 5000) {
      recommendations.push({
        agentId: perf.agentId,
        issue: `Average latency ${perf.avgLatencyMs}ms exceeds 5s target`,
        recommendation: `Optimize prompt length or model selection`,
        priority: "medium",
      });
    }
  }

  return { underperforming, recommendations };
}

/**
 * Evolve a prompt based on failure examples
 */
export async function evolvePrompt(params: {
  agentId: string;
  promptType: "vision" | "fix" | "preference";
  currentPrompt: string;
  failureExamples: TelemetryEvent[];
  successExamples: TelemetryEvent[];
  instruction?: string;
}): Promise<{
  evolvedPrompt: string;
  changes: string[];
  confidence: number;
}> {
  // This would typically call an LLM to rewrite the prompt
  // For MVP, we apply rule-based improvements

  const changes: string[] = [];
  let evolvedPrompt = params.currentPrompt;

  // Analyze failure patterns
  const commonErrors = analyzeFailurePatterns(params.failureExamples);

  // Apply improvements based on patterns
  if (commonErrors.includes("syntax_error")) {
    evolvedPrompt += `
\nCRITICAL: Ensure all generated code is syntactically valid. Check for balanced braces, parentheses, and quotes.`;
    changes.push("Added syntax validation reminder");
  }

  if (commonErrors.includes("missing_a11y")) {
    evolvedPrompt += `
\nCRITICAL: Every fix MUST include proper accessibility attributes. Never omit aria-labels, alt text, or focus states.`;
    changes.push("Strengthened a11y requirements");
  }

  if (commonErrors.includes("incomplete_fix")) {
    evolvedPrompt += `
\nCRITICAL: Provide complete, working solutions. Partial fixes that require manual completion are unacceptable.`;
    changes.push("Added completeness requirement");
  }

  if (params.instruction) {
    evolvedPrompt += `\n\nADDITIONAL INSTRUCTION: ${params.instruction}`;
    changes.push("Added custom instruction");
  }

  const confidence = Math.min(
    0.9,
    0.5 + params.successExamples.length / 100
  );

  return { evolvedPrompt, changes, confidence };
}

/**
 * Analyze failure patterns from telemetry events
 */
function analyzeFailurePatterns(events: TelemetryEvent[]): string[] {
  const patterns: string[] = [];
  const errors = events.filter((e) => e.error || e.userFeedback === "rejected");

  // Check for syntax errors
  const syntaxErrors = errors.filter((e) =>
    e.error?.toLowerCase().includes("syntax")
  );
  if (syntaxErrors.length > errors.length * 0.2) {
    patterns.push("syntax_error");
  }

  // Check for a11y issues
  const a11yErrors = errors.filter(
    (e) =>
      e.a11yViolationCount && e.a11yViolationCount > 0
  );
  if (a11yErrors.length > errors.length * 0.2) {
    patterns.push("missing_a11y");
  }

  // Check for incomplete fixes (heuristic: no output hash)
  const incomplete = errors.filter((e) => e.outputHash === "pending");
  if (incomplete.length > errors.length * 0.1) {
    patterns.push("incomplete_fix");
  }

  return patterns;
}

/**
 * Start an A/B test for a new prompt version
 */
export async function startABTest(params: {
  agentId: string;
  promptA: string;
  promptB: string;
  trafficSplit?: number;
  durationDays?: number;
}): Promise<ABTest> {
  const test: ABTest = {
    testId: randomUUID(),
    agentId: params.agentId,
    promptA: params.promptA,
    promptB: params.promptB,
    trafficSplit: params.trafficSplit ?? 0.1,
    startDate: new Date().toISOString(),
    status: "running",
  };

  await storeABTest(test);

  // Schedule test completion
  const durationMs = (params.durationDays ?? 3) * 24 * 60 * 60 * 1000;
  setTimeout(() => completeABTest(test.testId), durationMs);

  return test;
}

/**
 * Complete an A/B test and determine winner
 */
export async function completeABTest(testId: string): Promise<ABTest | null> {
  const tests = await loadABTests();
  const test = tests.find((t) => t.testId === testId);
  if (!test || test.status !== "running") return null;

  // Query telemetry for test results
  const since = test.startDate;
  const eventsA = await queryTelemetry({
    agentId: test.agentId,
    promptVersion: test.promptA,
    since,
  });
  const eventsB = await queryTelemetry({
    agentId: test.agentId,
    promptVersion: test.promptB,
    since,
  });

  const withFeedbackA = eventsA.filter((e) => e.userFeedback);
  const withFeedbackB = eventsB.filter((e) => e.userFeedback);

  const rateA =
    withFeedbackA.filter((e) => e.userFeedback === "accepted").length /
    (withFeedbackA.length || 1);
  const rateB =
    withFeedbackB.filter((e) => e.userFeedback === "accepted").length /
    (withFeedbackB.length || 1);

  // Determine winner (needs 5% improvement)
  let winner: "A" | "B" | "inconclusive" = "inconclusive";
  if (rateB > rateA + 0.05) {
    winner = "B";
  } else if (rateA > rateB + 0.05) {
    winner = "A";
  }

  test.endDate = new Date().toISOString();
  test.status = "completed";
  test.results = {
    samplesA: eventsA.length,
    samplesB: eventsB.length,
    acceptanceRateA: rateA,
    acceptanceRateB: rateB,
    winner,
  };

  await storeABTest(test);
  return test;
}

/**
 * Discover new issue types from uncategorized session data
 */
export async function discoverNewIssueTypes(
  sampleSessions: unknown[]
): Promise<DiscoveredIssueType[]> {
  const discovered: DiscoveredIssueType[] = [];

  // This would use clustering on session patterns
  // For MVP, we use rule-based pattern detection

  // Analyze click patterns for new issue types
  const clickPatterns = analyzeClickPatterns(sampleSessions);
  for (const pattern of clickPatterns) {
    discovered.push({
      typeId: `discovered_${pattern.name}`,
      discoveredAt: new Date().toISOString(),
      detectionPattern: pattern.description,
      sampleSessions: pattern.sampleIds,
      confidence: pattern.confidence,
      registered: false,
    });
  }

  return discovered;
}

/**
 * Analyze click patterns for new issue types
 */
function analyzeClickPatterns(
  sessions: unknown[]
): Array<{
  name: string;
  description: string;
  sampleIds: string[];
  confidence: number;
}> {
  const patterns: Array<{
    name: string;
    description: string;
    sampleIds: string[];
    confidence: number;
  }> = [];

  // Heuristic pattern detection
  // In production, this would use ML clustering

  // Example: Detect "rapid_mouse_movement" pattern
  const rapidMovementSessions = sessions.filter((s) =>
    JSON.stringify(s).includes("rapid")
  );
  if (rapidMovementSessions.length > 5) {
    patterns.push({
      name: "rapid_mouse_movement",
      description:
        "Users moving mouse rapidly between elements, possibly searching for functionality",
      sampleIds: rapidMovementSessions.map((_, i) => `session-${i}`),
      confidence: 0.6,
    });
  }

  return patterns;
}

/**
 * Register a discovered issue type if confidence is high enough
 */
export async function registerDiscoveredIssueType(
  discovered: DiscoveredIssueType,
  minConfidence: number = 0.7
): Promise<boolean> {
  if (discovered.confidence < minConfidence) {
    return false;
  }

  const definition: IssueTypeDefinition = {
    type: discovered.typeId,
    severity: "medium",
    confidenceThreshold: discovered.confidence,
    description: discovered.detectionPattern,
    detectableFrom: ["clicks"],
    detectSignature: `detect${discovered.typeId.replace(/_/g, "")}(sessions: SessionData[]): Issue[]`,
  };

  registerIssueType(definition, "meta-learner");
  discovered.registered = true;

  await storeDiscoveredIssue(discovered);
  return true;
}

/**
 * Run the Meta-Learner improvement cycle
 */
export async function runImprovementCycle(): Promise<{
  actions: string[];
  metrics: {
    agentsAnalyzed: number;
    promptsEvolved: number;
    abTestsStarted: number;
    newIssuesDiscovered: number;
  };
}> {
  const actions: string[] = [];

  // 1. Analyze agent performance
  const { underperforming, recommendations } = await analyzeAgentPerformance();
  actions.push(`Analyzed ${underperforming.length} underperforming agents`);

  // 2. Evolve prompts for underperforming agents
  let promptsEvolved = 0;
  for (const perf of underperforming) {
    if (perf.tasksCompleted < PROMPT_EVOLUTION_MIN_SAMPLES) {
      actions.push(
        `Skipping ${perf.agentId} - insufficient samples (${perf.tasksCompleted})`
      );
      continue;
    }

    const failures = await getFailureExamples("all", 20);
    const successes = await getSuccessExamples("all", 20);

    const evolution = await evolvePrompt({
      agentId: perf.agentId,
      promptType: perf.agentId === "ai-radiologist" ? "vision" : "fix",
      currentPrompt: "", // Would load from prompt registry
      failureExamples: failures,
      successExamples: successes,
    });

    // Store evolved prompt
    await storePromptVersion({
      versionId: randomUUID(),
      agentId: perf.agentId,
      promptType: perf.agentId === "ai-radiologist" ? "vision" : "fix",
      content: evolution.evolvedPrompt,
      createdAt: new Date().toISOString(),
      metrics: {
        samples: perf.tasksCompleted,
        acceptanceRate: perf.acceptanceRate,
        avgLatencyMs: perf.avgLatencyMs,
      },
      status: "testing",
    });

    promptsEvolved++;
    actions.push(
      `Evolved prompt for ${perf.agentId} with ${evolution.changes.length} changes`
    );
  }

  // 3. Start A/B tests for evolved prompts
  let abTestsStarted = 0;
  const pendingPrompts = await loadPromptVersions("testing");
  for (const prompt of pendingPrompts.slice(0, 2)) {
    // Start max 2 tests per cycle
    const currentPrompt = await loadCurrentPrompt(prompt.agentId, prompt.promptType);
    await startABTest({
      agentId: prompt.agentId,
      promptA: currentPrompt,
      promptB: prompt.content,
      trafficSplit: 0.1,
      durationDays: 3,
    });
    abTestsStarted++;
    actions.push(`Started A/B test for ${prompt.agentId} prompt`);
  }

  // 4. Update stored performance metrics
  for (const perf of await getAllAgentPerformance()) {
    await storeAgentPerformance(perf);
  }

  return {
    actions,
    metrics: {
      agentsAnalyzed: underperforming.length,
      promptsEvolved,
      abTestsStarted,
      newIssuesDiscovered: 0, // Would be populated from discoverNewIssueTypes
    },
  };
}

// Storage helpers
async function storePromptVersion(prompt: PromptVersion): Promise<void> {
  await mkdir(META_LEARNER_DIR, { recursive: true });
  const prompts = await loadPromptVersions();
  prompts.push(prompt);
  await writeFile(PROMPT_VERSIONS_FILE, JSON.stringify(prompts, null, 2));
}

async function loadPromptVersions(
  status?: "active" | "testing" | "retired"
): Promise<PromptVersion[]> {
  try {
    const content = await readFile(PROMPT_VERSIONS_FILE, "utf-8");
    const prompts = JSON.parse(content) as PromptVersion[];
    return status ? prompts.filter((p) => p.status === status) : prompts;
  } catch {
    return [];
  }
}

async function storeABTest(test: ABTest): Promise<void> {
  await mkdir(META_LEARNER_DIR, { recursive: true });
  const tests = await loadABTests();
  const idx = tests.findIndex((t) => t.testId === test.testId);
  if (idx >= 0) {
    tests[idx] = test;
  } else {
    tests.push(test);
  }
  await writeFile(A_B_TESTS_FILE, JSON.stringify(tests, null, 2));
}

async function loadABTests(): Promise<ABTest[]> {
  try {
    const content = await readFile(A_B_TESTS_FILE, "utf-8");
    return JSON.parse(content) as ABTest[];
  } catch {
    return [];
  }
}

async function storeDiscoveredIssue(issue: DiscoveredIssueType): Promise<void> {
  await mkdir(META_LEARNER_DIR, { recursive: true });
  const issues = await loadDiscoveredIssues();
  issues.push(issue);
  await writeFile(DISCOVERED_ISSUES_FILE, JSON.stringify(issues, null, 2));
}

async function loadDiscoveredIssues(): Promise<DiscoveredIssueType[]> {
  try {
    const content = await readFile(DISCOVERED_ISSUES_FILE, "utf-8");
    return JSON.parse(content) as DiscoveredIssueType[];
  } catch {
    return [];
  }
}

async function loadCurrentPrompt(
  agentId: string,
  promptType: string
): Promise<string> {
  // Would load from actual prompt registry
  // For MVP, return placeholder
  return `Current prompt for ${agentId} (${promptType})`;
}
