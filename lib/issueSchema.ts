export type IssueType = "dead_click" | "mobile_hidden_cta";

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
}

export interface FeedbackRequest {
  projectId: string;
  issueId: string;
  fixAccepted: boolean;
  editedByUser: boolean;
  notes?: string;
}
