import "server-only";
import type { Issue, GenerateFixResponse } from "../issueSchema";
import type { BillingStatus } from "../billing";
import { getAgentRole } from "../agentRoles";
import { recordTelemetry } from "../telemetry";

/**
 * Quality Sentinel Agent
 * Codename: quality-sentinel
 * Model: Rule-based + GPT-4o-mini for edge cases
 * Personality: Paranoid gatekeeper. Nothing ships without proof.
 *
 * Responsibilities:
 * - Gatekeeper: No fix ships without passing validation
 * - Structural validation against schemas
 * - Code syntax validation
 * - Accessibility audit (WCAG 2.1 AA)
 * - Design system compliance
 * - Risk assessment
 * - Performance budget enforcement
 */

export const QUALITY_SENTINEL_VERSION = "1.0.0";

// ─── Validation Result Types ─────────────────────────────────────────

export interface ValidationReport {
  issueId: string;
  passed: boolean;
  checks: ValidationCheck[];
  overallScore: number; // 0–1
  approvedForShip: boolean;
  reviewedAt: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  score: number; // 0–1
  details?: string;
  severity: "blocker" | "warning" | "info";
}

// ─── Quality Sentinel Agent ──────────────────────────────────────────

/**
 * Quality Sentinel
 * Purpose: Gatekeeper. No fix ships without passing validation.
 * Runs after frontendFixAgent generates code, before presenting to user.
 */
export async function validateFix(
  fix: GenerateFixResponse,
  originalIssue: Issue,
  context: {
    existingCode?: string;
    framework?: "react" | "vue" | "svelte";
    planFeatures?: BillingStatus["features"];
  }
): Promise<ValidationReport> {
  const checks: ValidationCheck[] = [];

  // 1. STRUCTURAL VALIDATION ───────────────────────────────────────
  const structural = validateStructure(fix);
  checks.push(structural);

  // 2. CODE SYNTAX VALIDATION ──────────────────────────────────────
  const syntax = await validateSyntax(fix.patchedCode.react);
  checks.push(syntax);

  // 3. ACCESSIBILITY AUDIT ─────────────────────────────────────────
  const a11y = await validateAccessibility(fix);
  checks.push(a11y);

  // 4. DESIGN SYSTEM COMPLIANCE ────────────────────────────────────
  const design = validateDesignSystemCompliance(fix);
  checks.push(design);

  // 5. RISK ASSESSMENT ─────────────────────────────────────────────
  const risk = assessRisk(fix, originalIssue);
  checks.push(risk);

  // 6. PERFORMANCE BUDGET ──────────────────────────────────────────
  const perf = validatePerformanceBudget(fix);
  checks.push(perf);

  // ─── Score Aggregation ───────────────────────────────────────────
  const blockerFailed = checks.some(
    (c) => c.severity === "blocker" && !c.passed
  );
  const avgScore =
    checks.reduce((sum, c) => sum + c.score, 0) / checks.length;

  const report: ValidationReport = {
    issueId: originalIssue.issueId,
    passed: !blockerFailed && avgScore >= 0.75,
    checks,
    overallScore: avgScore,
    approvedForShip: !blockerFailed && avgScore >= 0.85,
    reviewedAt: new Date().toISOString(),
  };

  // Record telemetry
  await recordTelemetry({
    agentId: "quality-sentinel",
    taskType: "validate",
    projectId: "system",
    issueId: originalIssue.issueId,
    inputHash: "fix-validation",
    outputHash: report.passed ? "passed" : "failed",
    latencyMs: 0,
    promptVersion: QUALITY_SENTINEL_VERSION,
    modelUsed: "rule-based",
    validationPassed: report.passed,
    confidence: avgScore,
  });

  return report;
}

// ─── Individual Validators ───────────────────────────────────────────

function validateStructure(fix: GenerateFixResponse): ValidationCheck {
  const required = ["diagnosis", "fixPlan", "patchedCode", "riskNotes", "confidence"];
  const missing = required.filter((k) => !(k in fix));

  return {
    name: "structural_completeness",
    passed: missing.length === 0,
    score: missing.length === 0 ? 1.0 : Math.max(0, 1 - missing.length * 0.25),
    details: missing.length ? `Missing fields: ${missing.join(", ")}` : "All required fields present",
    severity: "blocker",
  };
}

async function validateSyntax(reactCode: string): Promise<ValidationCheck> {
  try {
    // Lightweight parse check — in production, use esbuild or babel
    if (!reactCode.includes("export") && !reactCode.includes("function")) {
      return {
        name: "code_syntax",
        passed: false,
        score: 0,
        details: "Generated code missing export or function declaration",
        severity: "blocker",
      };
    }

    // Check for common syntax killers
    const unclosed = (reactCode.match(/</g) || []).length !== (reactCode.match(/>/g) || []).length;

    return {
      name: "code_syntax",
      passed: !unclosed,
      score: unclosed ? 0.3 : 1.0,
      details: unclosed ? "Unclosed JSX tags detected" : "Syntax appears valid",
      severity: "blocker",
    };
  } catch (e) {
    return {
      name: "code_syntax",
      passed: false,
      score: 0,
      details: `Parse error: ${e instanceof Error ? e.message : "unknown"}`,
      severity: "blocker",
    };
  }
}

async function validateAccessibility(fix: GenerateFixResponse): Promise<ValidationCheck> {
  const code = fix.patchedCode.react.toLowerCase();
  const issues: string[] = [];

  // Basic heuristics (production: integrate axe-core)
  if (code.includes("onclick") && !code.includes("role=") && !code.includes("button")) {
    issues.push("Click handler without button role or semantic button");
  }
  if (code.includes("<img") && !code.includes("alt=")) {
    issues.push("Image missing alt text");
  }
  if (code.includes("color:") || code.includes("text-")) {
    // Check for color-only indicators
    if (!code.includes("aria-label") && !code.includes("title=")) {
      issues.push("Potential color-only information without text alternative");
    }
  }

  // Check for focus states
  if (!code.includes("focus-visible") && !code.includes("focus:")) {
    issues.push("Missing focus-visible states for keyboard navigation");
  }

  // Check for semantic HTML
  if (code.includes("<div") && code.includes("onclick") && !code.includes("role=")) {
    issues.push("Non-semantic clickable div without role");
  }

  return {
    name: "accessibility_wcag",
    passed: issues.length === 0,
    score: Math.max(0, 1 - issues.length * 0.2),
    details: issues.length ? issues.join("; ") : "No basic a11y violations detected",
    severity: "blocker",
  };
}

function validateDesignSystemCompliance(fix: GenerateFixResponse): ValidationCheck {
  const tailwind = fix.patchedCode.cssOrTailwind.toLowerCase();

  // Enforce token usage instead of arbitrary values
  const arbitraryValues = tailwind.match(/\[\d+px\]|\[\d+rem\]/g) || [];

  return {
    name: "design_system_compliance",
    passed: arbitraryValues.length <= 2,
    score: Math.max(0, 1 - arbitraryValues.length * 0.15),
    details: arbitraryValues.length
      ? `Found ${arbitraryValues.length} arbitrary Tailwind values. Prefer design tokens.`
      : "Uses standard Tailwind utilities",
    severity: "warning",
  };
}

function assessRisk(fix: GenerateFixResponse, issue: Issue): ValidationCheck {
  const risks = fix.riskNotes || [];
  const highRiskTerms = ["break", "crash", "security", "data loss", "redirect loop"];

  const hasHighRisk = risks.some((r) =>
    highRiskTerms.some((term) => r.toLowerCase().includes(term))
  );

  return {
    name: "risk_assessment",
    passed: !hasHighRisk || fix.confidence >= 0.9,
    score: hasHighRisk ? (fix.confidence >= 0.9 ? 0.7 : 0.3) : 1.0,
    details: hasHighRisk
      ? `High-risk fix detected with confidence ${fix.confidence}. Manual review required.`
      : `Risk level acceptable. ${risks.length} risk notes documented.`,
    severity: hasHighRisk ? "blocker" : "info",
  };
}

function validatePerformanceBudget(fix: GenerateFixResponse): ValidationCheck {
  const codeSize = new Blob([fix.patchedCode.react + fix.patchedCode.cssOrTailwind]).size;
  const budget = 15 * 1024; // 15KB budget for a fix

  return {
    name: "performance_budget",
    passed: codeSize <= budget,
    score: Math.min(1, budget / codeSize),
    details: `Fix size: ${(codeSize / 1024).toFixed(2)}KB (budget: ${budget / 1024}KB)`,
    severity: "warning",
  };
}

// ─── Additional Validation Utilities ─────────────────────────────────

/**
 * Validate an issue against schema and business rules
 */
export async function validateIssue(
  issue: Issue
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Schema validation
  if (!issue.issueId || typeof issue.issueId !== "string") {
    errors.push("Issue missing valid issueId");
  }

  if (!issue.type || typeof issue.type !== "string") {
    errors.push("Issue missing valid type");
  }

  if (!["high", "medium", "low"].includes(issue.severity)) {
    errors.push(`Invalid severity: ${issue.severity}`);
  }

  if (issue.confidence < 0 || issue.confidence > 1) {
    errors.push(`Confidence out of range: ${issue.confidence}`);
  }

  if (!issue.summary || issue.summary.length < 10) {
    errors.push("Summary too short or missing");
  }

  if (!Array.isArray(issue.evidence) || issue.evidence.length === 0) {
    errors.push("Issue must have at least one evidence item");
  }

  // Business rules
  if (issue.confidence < 0.5) {
    errors.push(`Confidence too low: ${issue.confidence} (min: 0.5)`);
  }

  if (issue.severity === "high" && issue.confidence < 0.7) {
    errors.push("High severity issues require confidence >= 0.7");
  }

  // Record telemetry
  await recordTelemetry({
    agentId: "quality-sentinel",
    taskType: "validate",
    projectId: "system",
    issueId: issue.issueId,
    inputHash: "issue-validation",
    outputHash: errors.length > 0 ? "invalid" : "valid",
    latencyMs: 0,
    promptVersion: QUALITY_SENTINEL_VERSION,
    modelUsed: "rule-based",
    validationPassed: errors.length === 0,
    confidence: issue.confidence,
  });

  return { valid: errors.length === 0, errors };
}

// ─── Batch Validation for Dashboard ──────────────────────────────────

export async function validateBatch(
  fixes: Array<{ fix: GenerateFixResponse; issue: Issue }>
): Promise<{ passed: number; failed: number; avgScore: number; reports: ValidationReport[] }> {
  const reports = await Promise.all(
    fixes.map(({ fix, issue }) => validateFix(fix, issue, {}))
  );

  const passed = reports.filter((r) => r.passed).length;
  const avgScore = reports.reduce((s, r) => s + r.overallScore, 0) / reports.length;

  return {
    passed,
    failed: reports.length - passed,
    avgScore,
    reports,
  };
}

// ─── Legacy Support ───────────────────────────────────────────────────

/**
 * Get Quality Sentinel system context
 */
export function getQualitySentinelSystemContext(): string {
  return getAgentRole("quality-sentinel").systemContext;
}

/**
 * Run full quality pipeline on a fix (legacy compatibility)
 */
export async function runQualityPipeline(
  issue: Issue,
  fix: GenerateFixResponse,
  _originalCode?: string
): Promise<{
  passed: boolean;
  validation: {
    passed: boolean;
    syntaxValid: boolean;
    a11yViolations: string[];
    bundleImpactKb: number;
    errors: string[];
  };
  abTestSpec?: {
    shouldTest: boolean;
    testSpec?: {
      name: string;
      hypothesis: string;
      variantA: string;
      variantB: string;
      successMetric: string;
      minSampleSize: number;
      durationDays: number;
    };
  };
}> {
  const report = await validateFix(fix, issue, {});

  const validation = {
    passed: report.passed,
    syntaxValid: report.checks.find((c) => c.name === "code_syntax")?.passed ?? false,
    a11yViolations: [],
    bundleImpactKb: 0,
    errors: report.checks
      .filter((c) => !c.passed)
      .map((c) => `${c.name}: ${c.details}`),
  };

  // Generate A/B test spec for high-confidence fixes
  const abTestSpec =
    report.passed && issue.severity === "high" && fix.confidence >= 0.85
      ? {
          shouldTest: true as const,
          testSpec: {
            name: `Fix for ${issue.type} - ${issue.issueId.slice(0, 8)}`,
            hypothesis: `Fixing ${issue.type} will reduce friction and improve conversion`,
            variantA: "Original (control)",
            variantB: fix.patchedCode.react.slice(0, 100) + "...",
            successMetric: "conversion_rate",
            minSampleSize: 1000,
            durationDays: 14,
          },
        }
      : { shouldTest: false as const };

  return {
    passed: report.passed,
    validation,
    abTestSpec,
  };
}
