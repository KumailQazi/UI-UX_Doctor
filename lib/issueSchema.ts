// Extended issue taxonomy - pluggable and self-improving via Meta-Learner
export type IssueType =
  | "dead_click"
  | "mobile_hidden_cta"
  | "form_field_confusion"
  | "carousel_skip_rate"
  | "rage_click_pattern"
  | "scroll_stop"
  | "hover_hesitation"
  | "error_message_confusion"
  | "navigation_loop"
  | string; // Allow dynamic issue types discovered by Meta-Learner

export type Severity = "high" | "medium" | "low";

export interface HeatmapPoint {
  leftPct: number;
  topPct: number;
  intensity: number;
}

export interface EvidenceItem {
  timestampSec: number;
  frameRef?: string;
  note: string;
}

export interface Issue {
  issueId: string;
  type: IssueType;
  severity: Severity;
  summary: string;
  evidence: EvidenceItem[];
  confidence: number;
  whyItMatters: string;
  heatmapPoints?: HeatmapPoint[];
  peakLabel?: string;
  // Extended for cross-session correlation
  sessionCount?: number;
  occurrenceRate?: number;
  affectedViewports?: string[];
  // Traceability
  detectedBy?: string; // Agent codename that detected this
  promptVersion?: string; // Which prompt version was used
}

export interface AnalyzeResponse {
  jobId: string;
  issues: Issue[];
}

export interface GenerateFixRequest {
  projectId: string;
  issue: Issue;
  componentContext?: {
    framework?: "react";
    styling?: "tailwind" | "css";
    existingCode?: string;
  };
}

export interface ValidationResult {
  passed: boolean;
  syntaxValid: boolean;
  a11yViolations: string[];
  visualDiffScore?: number;
  bundleImpactKb?: number;
  errors: string[];
}

export interface GenerateFixResponse {
  diagnosis: string;
  fixPlan: string[];
  patchedCode: {
    react: string;
    cssOrTailwind: string;
  };
  riskNotes: string[];
  confidence: number;
  personalizedNote?: string;
  // Extended for quality tracking
  validationResult?: ValidationResult;
  generatedBy?: string; // Agent codename
  promptVersion?: string;
  // Diff precision
  unifiedDiff?: string;
  // Responsive variants
  mobileVariant?: string;
  desktopVariant?: string;
}

export interface FeedbackRequest {
  projectId: string;
  issueId: string;
  fixAccepted: boolean;
  editedByUser: boolean;
  notes?: string;
  // Extended telemetry
  latencyMs?: number;
  agentId?: string;
  promptVersion?: string;
}

// Telemetry event for Meta-Learner
export interface TelemetryEvent {
  timestamp: string;
  eventId: string;
  agentId: string;
  taskType: "analyze" | "generate_fix" | "validate" | "feedback";
  projectId: string;
  issueId?: string;
  inputHash: string;
  outputHash: string;
  latencyMs: number;
  userFeedback?: "accepted" | "rejected" | "modified";
  error?: string;
  promptVersion: string;
  modelUsed: string;
  confidence?: number;
  // Extended metrics
  validationPassed?: boolean;
  a11yViolationCount?: number;
  bundleImpactKb?: number;
}

// Agent performance metrics for Lead Surgeon
export interface AgentPerformance {
  agentId: string;
  tasksCompleted: number;
  acceptanceRate: number;
  avgLatencyMs: number;
  errorRate: number;
  falsePositiveRate?: number;
  lastEvaluatedAt: string;
}

// Preference memory with vector embeddings
export interface PreferenceMemory {
  projectId: string;
  embeddings: number[];
  rules: string[];
  acceptedFixes: string[];
  rejectedFixes: string[];
  componentPatterns: string[];
  designTokens?: Record<string, string>;
  updatedAt: string;
}
