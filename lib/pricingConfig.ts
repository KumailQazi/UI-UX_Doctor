import "server-only";

export type PlanCode = "free" | "pro" | "enterprise";
export type BillableAction = "analyze" | "generate_fix";

export interface FeatureFlags {
  personalization: boolean;
  dashboard: boolean;
  jira: boolean;
}

export interface Entitlement {
  plan: PlanCode;
  limits: Record<BillableAction, number>;
  features: FeatureFlags;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export const PLAN_PRESETS: Record<PlanCode, Entitlement> = {
  free: {
    plan: "free",
    limits: {
      analyze: readPositiveInt("UIUX_DOCTOR_FREE_ANALYZE_LIMIT", 25),
      generate_fix: readPositiveInt("UIUX_DOCTOR_FREE_GENERATE_FIX_LIMIT", 100),
    },
    features: {
      personalization: false,
      dashboard: true,
      jira: false,
    },
  },
  pro: {
    plan: "pro",
    limits: {
      analyze: readPositiveInt("UIUX_DOCTOR_PRO_ANALYZE_LIMIT", 1000),
      generate_fix: readPositiveInt("UIUX_DOCTOR_PRO_GENERATE_FIX_LIMIT", 5000),
    },
    features: {
      personalization: true,
      dashboard: true,
      jira: true,
    },
  },
  enterprise: {
    plan: "enterprise",
    limits: {
      analyze: readPositiveInt("UIUX_DOCTOR_ENTERPRISE_ANALYZE_LIMIT", 100000),
      generate_fix: readPositiveInt("UIUX_DOCTOR_ENTERPRISE_GENERATE_FIX_LIMIT", 500000),
    },
    features: {
      personalization: true,
      dashboard: true,
      jira: true,
    },
  },
};
