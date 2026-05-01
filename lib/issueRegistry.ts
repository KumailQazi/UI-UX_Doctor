import type { IssueType, Severity, Issue } from "./issueSchema";

/**
 * Issue Taxonomy Registry
 * Pluggable issue detection system allowing Meta-Learner to register new issue types
 */

export interface IssueTypeDefinition {
  type: IssueType;
  severity: Severity;
  confidenceThreshold: number;
  description: string;
  detectableFrom: ("frames" | "clicks" | "scrolls" | "forms" | "errors")[];
  // Detection function signature - implementations in aiRadiologistAgent.ts
  detectSignature: string;
}

// Core issue taxonomy - foundation types
export const CORE_ISSUE_TAXONOMY: Record<string, IssueTypeDefinition> = {
  dead_click: {
    type: "dead_click",
    severity: "high",
    confidenceThreshold: 0.85,
    description:
      "Element appears clickable but is non-interactive or unresponsive",
    detectableFrom: ["frames", "clicks"],
    detectSignature:
      "detectDeadClick(frames: ExtractedFrame[], clicks: ClickEvent[]): Issue[]",
  },
  mobile_hidden_cta: {
    type: "mobile_hidden_cta",
    severity: "high",
    confidenceThreshold: 0.8,
    description: "Key CTA is below fold, obscured, or unreachable on mobile",
    detectableFrom: ["frames"],
    detectSignature:
      "detectHiddenCTA(frames: ExtractedFrame[], viewport: ViewportInfo): Issue[]",
  },
  form_field_confusion: {
    type: "form_field_confusion",
    severity: "medium",
    confidenceThreshold: 0.75,
    description: "Users struggle to understand form field requirements or labels",
    detectableFrom: ["frames", "clicks", "forms"],
    detectSignature:
      "detectFormConfusion(frames: ExtractedFrame[], formEvents: FormEvent[]): Issue[]",
  },
  carousel_skip_rate: {
    type: "carousel_skip_rate",
    severity: "low",
    confidenceThreshold: 0.7,
    description: "Users rapidly skip past carousel content without engaging",
    detectableFrom: ["clicks", "scrolls"],
    detectSignature:
      "detectCarouselSkip(interactions: InteractionEvent[]): Issue[]",
  },
  rage_click_pattern: {
    type: "rage_click_pattern",
    severity: "high",
    confidenceThreshold: 0.8,
    description: "Rapid repeated clicks indicating frustration",
    detectableFrom: ["clicks"],
    detectSignature: "detectRageClicks(clicks: ClickEvent[]): Issue[]",
  },
  scroll_stop: {
    type: "scroll_stop",
    severity: "medium",
    confidenceThreshold: 0.75,
    description: "User stops scrolling abruptly, indicating content confusion",
    detectableFrom: ["scrolls"],
    detectSignature: "detectScrollStop(scrollEvents: ScrollEvent[]): Issue[]",
  },
  hover_hesitation: {
    type: "hover_hesitation",
    severity: "low",
    confidenceThreshold: 0.7,
    description: "Extended hover without action, indicating uncertainty",
    detectableFrom: ["frames"],
    detectSignature:
      "detectHoverHesitation(frames: ExtractedFrame[]): Issue[]",
  },
  error_message_confusion: {
    type: "error_message_confusion",
    severity: "high",
    confidenceThreshold: 0.8,
    description: "Error messages cause user confusion or repeat errors",
    detectableFrom: ["frames", "errors", "forms"],
    detectSignature:
      "detectErrorConfusion(frames: ExtractedFrame[], errors: ErrorEvent[]): Issue[]",
  },
  navigation_loop: {
    type: "navigation_loop",
    severity: "medium",
    confidenceThreshold: 0.75,
    description: "User cycles between pages without completing task",
    detectableFrom: ["frames"],
    detectSignature: "detectNavigationLoop(frames: ExtractedFrame[]): Issue[]",
  },
};

// Extended taxonomy - auto-discovered by Meta-Learner
let extendedTaxonomy: Record<string, IssueTypeDefinition> = {};

/**
 * Register a new issue type discovered by Meta-Learner
 */
export function registerIssueType(
  definition: IssueTypeDefinition,
  registeredBy: string = "meta-learner"
): void {
  const key = definition.type as string;
  if (CORE_ISSUE_TAXONOMY[key]) {
    console.warn(
      `[IssueRegistry] Attempted to register existing core type: ${key}`
    );
    return;
  }
  extendedTaxonomy[key] = { ...definition, description: `${definition.description} (registered by ${registeredBy})` };
  console.log(`[IssueRegistry] Registered new issue type: ${key}`);
}

/**
 * Get all available issue types (core + extended)
 */
export function getAllIssueTypes(): Record<string, IssueTypeDefinition> {
  return { ...CORE_ISSUE_TAXONOMY, ...extendedTaxonomy };
}

/**
 * Get issue type definition by key
 */
export function getIssueTypeDefinition(
  type: IssueType
): IssueTypeDefinition | undefined {
  const key = type as string;
  return CORE_ISSUE_TAXONOMY[key] ?? extendedTaxonomy[key];
}

/**
 * Get confidence threshold for an issue type
 */
export function getConfidenceThreshold(type: IssueType): number {
  const def = getIssueTypeDefinition(type);
  return def?.confidenceThreshold ?? 0.75;
}

/**
 * Check if an issue type is registered
 */
export function isRegisteredIssueType(type: IssueType): boolean {
  const key = type as string;
  return key in CORE_ISSUE_TAXONOMY || key in extendedTaxonomy;
}

/**
 * Get list of issue types detectable from specific data sources
 */
export function getDetectableIssueTypes(
  sources: ("frames" | "clicks" | "scrolls" | "forms" | "errors")[]
): IssueType[] {
  const allTypes = getAllIssueTypes();
  return Object.values(allTypes)
    .filter((def) =>
      def.detectableFrom.some((source) => sources.includes(source))
    )
    .map((def) => def.type);
}

/**
 * Validate issue confidence against type-specific threshold
 */
export function validateIssueConfidence(issue: Issue): boolean {
  const threshold = getConfidenceThreshold(issue.type);
  return issue.confidence >= threshold;
}

/**
 * Get severity for an issue type (can be overridden per issue)
 */
export function getDefaultSeverity(type: IssueType): Severity {
  const def = getIssueTypeDefinition(type);
  return def?.severity ?? "medium";
}

// Session event types for detection functions
export interface ExtractedFrame {
  timestampSec: number;
  frameRef: string;
  viewport?: { width: number; height: number };
}

export interface ClickEvent {
  timestampSec: number;
  x: number;
  y: number;
  element?: string;
  targetText?: string;
}

export interface ScrollEvent {
  timestampSec: number;
  scrollY: number;
  deltaY: number;
  velocity: number;
}

export interface FormEvent {
  timestampSec: number;
  fieldName: string;
  action: "focus" | "blur" | "change" | "submit";
  value?: string;
  hasError?: boolean;
}

export interface ErrorEvent {
  timestampSec: number;
  message: string;
  type: "validation" | "server" | "client";
  fieldName?: string;
}

export interface InteractionEvent {
  timestampSec: number;
  type: "click" | "scroll" | "hover" | "swipe";
  x?: number;
  y?: number;
  element?: string;
  duration?: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  deviceType: "mobile" | "tablet" | "desktop";
}
