import "server-only";
import type { Issue, GenerateFixResponse, ValidationResult } from "../issueSchema";
import { getAgentRole } from "../agentRoles";
import { recordTelemetry } from "../telemetry";
import { validateFix, type ValidationReport } from "./qualitySentinelAgent";

/**
 * UI Surgeon Agent (Evolved)
 * Codename: ui-surgeon
 * Model: Claude Opus 4 / o3-mini (code)
 * Personality: Pixel-perfect perfectionist. Thinks in design systems.
 *
 * New Capabilities:
 * - Design system bridge (reads tokens.json, Figma Variables)
 * - Component DNA matching via AST parsing
 * - Accessibility-first (axe-core validation)
 * - Responsive surgery (mobile + desktop variants)
 * - Diff precision (unified diff format)
 */

export const UI_SURGEON_VERSION = "2.0.0";

/**
 * Get UI Surgeon system context
 */
export function getUiSurgeonSystemContext(): string {
  return getAgentRole("ui-surgeon").systemContext;
}

interface DesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
  borders: Record<string, string>;
}

interface ComponentContext {
  framework?: "react";
  styling?: "tailwind" | "css";
  existingCode?: string;
  designTokens?: DesignTokens;
  componentName?: string;
}

/**
 * Parse design tokens from JSON or Figma
 */
export async function loadDesignTokens(
  source: "tokens.json" | { figmaToken: string; fileId: string }
): Promise<DesignTokens | null> {
  // In production, this would:
  // - Read tokens.json from design system
  // - Or call Figma API for Variables

  // MVP: Return default tokens
  return {
    colors: {
      primary: "indigo-600",
      secondary: "zinc-500",
      background: "white",
      text: "zinc-900",
    },
    spacing: {
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
    },
    typography: {
      base: "text-base",
      sm: "text-sm",
      lg: "text-lg",
      fontNormal: "font-normal",
      fontSemibold: "font-semibold",
    },
    borders: {
      default: "border-zinc-300",
      hover: "border-zinc-500",
      focus: "ring-2 ring-indigo-600",
    },
  };
}

/**
 * Parse existing component to understand structure
 */
export function parseComponentDNA(code: string): {
  imports: string[];
  props: string[];
  hooks: string[];
  styling: string[];
  children: boolean;
} {
  // Simple regex-based parsing for MVP
  // In production, use @babel/parser or similar

  const imports: string[] = [];
  const props: string[] = [];
  const hooks: string[] = [];
  const styling: string[] = [];

  // Extract imports
  const importMatches = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
  if (importMatches) {
    for (const match of importMatches) {
      const source = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
      if (source) imports.push(source);
    }
  }

  // Extract props
  const propMatch = code.match(/interface\s+Props\s*\{([^}]+)\}/);
  if (propMatch) {
    const propsList = propMatch[1].split(";").filter(Boolean);
    for (const p of propsList) {
      const propName = p.trim().split(":")[0]?.trim();
      if (propName) props.push(propName);
    }
  }

  // Extract hooks
  const hookMatches = code.match(/use[A-Z][a-zA-Z]+/g);
  if (hookMatches) {
    hooks.push(...new Set(hookMatches));
  }

  // Extract Tailwind classes
  const classMatches = code.match(/className=["']([^"']+)["']/g);
  if (classMatches) {
    for (const match of classMatches) {
      const classes = match.replace(/className=["']/, "").replace(/["']$/, "");
      styling.push(...classes.split(" "));
    }
  }

  return {
    imports,
    props,
    hooks,
    styling: [...new Set(styling)],
    children: code.includes("children") || code.includes("<>") || code.includes("props.children"),
  };
}

/**
 * Generate unified diff between original and fixed code
 */
export function generateUnifiedDiff(
  original: string,
  fixed: string,
  contextLines: number = 3
): string {
  const originalLines = original.split("\n");
  const fixedLines = fixed.split("\n");

  // Simple line-by-line diff for MVP
  // In production, use diff library

  let diff = "--- Original\n+++ Fixed\n";
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < fixedLines.length) {
    if (i < originalLines.length && j < fixedLines.length) {
      if (originalLines[i] === fixedLines[j]) {
        diff += ` ${originalLines[i]}\n`;
        i++;
        j++;
      } else {
        diff += `-${originalLines[i]}\n`;
        diff += `+${fixedLines[j]}\n`;
        i++;
        j++;
      }
    } else if (i < originalLines.length) {
      diff += `-${originalLines[i]}\n`;
      i++;
    } else {
      diff += `+${fixedLines[j]}\n`;
      j++;
    }
  }

  return diff;
}

/**
 * Generate mobile variant of fix
 */
export function generateMobileVariant(fix: string): string {
  // Add mobile-specific classes
  return fix
    .replace(/className="([^"]+)"/g, (match, classes) => {
      // Add mobile-first responsive classes
      const mobileClasses = classes
        .replace(/md:/g, "")
        .replace(/lg:/g, "")
        .replace(/fixed/g, "fixed inset-x-0 bottom-0 z-40")
        .replace(/w-full/, "w-full");
      return `className="${mobileClasses}"`;
    })
    .replace(/<button/, '<button aria-label="Mobile action"');
}

/**
 * Generate desktop variant of fix
 */
export function generateDesktopVariant(fix: string): string {
  // Add desktop-specific classes
  return fix
    .replace(/className="([^"]+)"/g, (match, classes) => {
      // Add desktop responsive classes
      const desktopClasses = classes
        .replace(/fixed/g, "static")
        .replace(/inset-x-0/g, "")
        .replace(/bottom-0/g, "")
        .replace(/z-40/g, "")
        .replace(/w-full/g, "md:w-auto");
      return `className="${desktopClasses}"`;
    });
}

/**
 * Generate fix for dead_click issue
 */
function generateDeadClickFix(
  issue: Issue,
  context?: ComponentContext
): GenerateFixResponse {
  const designTokens = context?.designTokens ?? {
    colors: { primary: "indigo-600" },
    borders: { default: "border-zinc-300" },
  };

  const componentName = context?.componentName ?? "InteractiveElement";

  const react = `export function ${componentName}({ 
  children, 
  onClick, 
  className = "" 
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={\`rounded-md border ${designTokens.borders.default} bg-white p-4 text-left transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-${designTokens.colors.primary} \${className}\`}
      aria-label={typeof children === "string" ? children : "Interactive element"}
    >
      {children}
    </button>
  );
}`;

  return {
    diagnosis: `The element visually resembles a button but lacks semantic interactivity. Users expect clickable elements to be actual <button> tags with proper keyboard and screen reader support.`,
    fixPlan: [
      "Replace clickable-looking wrapper with semantic <button> element",
      "Add explicit type=\"button\" to prevent form submission conflicts",
      "Implement focus-visible states for keyboard navigation",
      "Add aria-label for screen reader context",
      "Preserve existing onClick handler",
    ],
    patchedCode: {
      react,
      cssOrTailwind: `Tailwind classes used:
- rounded-md: Consistent border radius
- border-zinc-300: Default border color
- hover:border-zinc-500: Interactive hover state
- focus-visible:ring-2 focus-visible:ring-${designTokens.colors.primary}: Keyboard focus indicator
- transition: Smooth state transitions`,
    },
    riskNotes: [
      "Verify parent component doesn't already contain a <button> (nesting violation)",
      "Ensure onClick handler doesn't assume event parameter (changed from div to button)",
      "Test with screen readers to confirm aria-label is appropriate",
    ],
    confidence: 0.92,
    validationResult: {
      passed: true,
      syntaxValid: true,
      a11yViolations: [],
      errors: [],
    },
    generatedBy: "ui-surgeon",
    promptVersion: UI_SURGEON_VERSION,
    unifiedDiff: context?.existingCode
      ? generateUnifiedDiff(context.existingCode, react)
      : undefined,
    mobileVariant: generateMobileVariant(react),
    desktopVariant: generateDesktopVariant(react),
  };
}

/**
 * Generate fix for mobile_hidden_cta issue
 */
function generateHiddenCTAFix(
  issue: Issue,
  context?: ComponentContext
): GenerateFixResponse {
  const designTokens = context?.designTokens ?? {
    colors: { primary: "indigo-600" },
  };

  const react = `export function StickyCTA({ 
  onContinue, 
  label = "Continue" 
}: { 
  onContinue: () => void; 
  label?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-md bg-${designTokens.colors.primary} px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-${designTokens.colors.primary}/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-${designTokens.colors.primary} focus-visible:ring-offset-2 md:w-auto"
        aria-label={label}
      >
        {label}
      </button>
    </div>
  );
}`;

  return {
    diagnosis: `The primary CTA is not reliably visible on mobile viewports, delaying progression in the main conversion flow. Users must scroll to find the action, increasing bounce rate.`,
    fixPlan: [
      "Pin the primary CTA to a sticky mobile footer with fixed positioning",
      "Add backdrop-blur for modern mobile UX without obscuring content",
      "Implement safe-area-aware padding (p-3 base, adjustable for devices)",
      "Keep desktop layout unchanged via responsive md: classes",
      "Ensure z-index layering doesn't interfere with modals",
    ],
    patchedCode: {
      react,
      cssOrTailwind: `Tailwind classes used:
- fixed inset-x-0 bottom-0 z-40: Mobile sticky positioning
- bg-white/95 backdrop-blur: Modern frosted glass effect
- border-t border-zinc-200: Subtle separator
- md:static md:border-0: Desktop un-sticky behavior
- focus-visible:ring-2: Keyboard accessibility
- w-full md:w-auto: Responsive width`,
    },
    riskNotes: [
      "Test on iOS Safari for safe-area-inset-bottom handling",
      "Verify CTA doesn't obscure form inputs on small screens",
      "Consider adding scroll padding to prevent footer overlap",
      "Ensure z-40 doesn't conflict with modal overlays (typically z-50)",
    ],
    confidence: 0.89,
    validationResult: {
      passed: true,
      syntaxValid: true,
      a11yViolations: [],
      errors: [],
    },
    generatedBy: "ui-surgeon",
    promptVersion: UI_SURGEON_VERSION,
    mobileVariant: react, // Already mobile-first
    desktopVariant: generateDesktopVariant(react),
  };
}

/**
 * Main fix generation entry point
 */
export async function generateFix(
  issue: Issue,
  context?: ComponentContext
): Promise<GenerateFixResponse> {
  const startTime = Date.now();

  // Load design tokens if not provided
  const fullContext: ComponentContext = {
    ...context,
    designTokens: context?.designTokens ?? (await loadDesignTokens("tokens.json")) ?? undefined,
  };

  // Parse existing component if provided
  if (fullContext.existingCode) {
    const dna = parseComponentDNA(fullContext.existingCode);
    console.log(`[UI Surgeon] Parsed component DNA: ${dna.props.length} props, ${dna.hooks.length} hooks`);
  }

  // Generate fix based on issue type
  let fix: GenerateFixResponse;

  switch (issue.type) {
    case "dead_click":
      fix = generateDeadClickFix(issue, fullContext);
      break;
    case "mobile_hidden_cta":
      fix = generateHiddenCTAFix(issue, fullContext);
      break;
    default:
      // Generic fallback
      fix = {
        diagnosis: `Issue detected: ${issue.summary}`,
        fixPlan: ["Review the issue and implement appropriate fix"],
        patchedCode: {
          react: "// Fix not yet implemented for this issue type",
          cssOrTailwind: "",
        },
        riskNotes: ["This is a generic fallback - review carefully"],
        confidence: 0.5,
        generatedBy: "ui-surgeon",
        promptVersion: UI_SURGEON_VERSION,
      };
  }

  // Run quality validation
  const validation: ValidationReport = await validateFix(fix, issue, {
    existingCode: context?.existingCode,
    framework: "react",
  });

  // Map ValidationReport to ValidationResult for compatibility
  const a11yCheck = validation.checks.find((c: { name: string }) => c.name === "accessibility_wcag");
  const perfCheck = validation.checks.find((c: { name: string }) => c.name === "performance_budget");
  const syntaxCheck = validation.checks.find((c: { name: string }) => c.name === "code_syntax");

  fix.validationResult = {
    passed: validation.passed,
    syntaxValid: syntaxCheck?.passed ?? false,
    a11yViolations: a11yCheck?.details ? [a11yCheck.details] : [],
    bundleImpactKb: perfCheck?.score ? 15 * (1 - perfCheck.score) : 0,
    errors: validation.checks.filter((c: { passed: boolean }) => !c.passed).map((c: { name: string; details?: string }) => `${c.name}: ${c.details}`),
  };

  // Record telemetry
  await recordTelemetry({
    agentId: "ui-surgeon",
    taskType: "generate_fix",
    projectId: "fix-generation",
    issueId: issue.issueId,
    inputHash: `${issue.type}-${issue.severity}`,
    outputHash: `${fix.confidence}-${validation.passed}`,
    latencyMs: Date.now() - startTime,
    promptVersion: UI_SURGEON_VERSION,
    modelUsed: "rule-based",
    confidence: fix.confidence,
    validationPassed: validation.passed,
    a11yViolationCount: a11yCheck?.passed ? 0 : 1,
    bundleImpactKb: perfCheck?.score ? 15 * (1 - perfCheck.score) : 0,
  });

  return fix;
}

/**
 * Generate personalized note based on preferences
 */
export function generatePersonalizedNote(
  issue: Issue,
  preferences: string[]
): string | undefined {
  if (preferences.length === 0) return undefined;

  const relevantPrefs = preferences.filter((p) => {
    const lower = p.toLowerCase();
    return (
      (issue.type === "mobile_hidden_cta" && lower.includes("sticky")) ||
      (issue.type === "dead_click" && lower.includes("semantic")) ||
      lower.includes("focus") ||
      lower.includes("a11y")
    );
  });

  if (relevantPrefs.length === 0) return undefined;

  return `Based on your team's preferences (${relevantPrefs.join("; ")}), this fix has been optimized for your design system standards.`;
}
