import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PlanCode = "free" | "pro" | "enterprise";
type BillableAction = "analyze" | "generate_fix";

interface FeatureFlags {
  personalization: boolean;
  dashboard: boolean;
  jira: boolean;
}

interface Entitlement {
  plan: PlanCode;
  limits: Record<BillableAction, number>;
  features: FeatureFlags;
}

interface UsageCounter {
  analyze: number;
  generate_fix: number;
}

interface BillingState {
  orgByProject: Record<string, string>;
  entitlements: Record<string, Entitlement>;
  usage: Record<string, Record<string, UsageCounter>>;
}

interface GuardResult {
  allowed: boolean;
  orgId: string;
  plan: PlanCode;
  remaining: number;
  used: number;
  limit: number;
  features: FeatureFlags;
  reason?: "limit_reached";
}

export interface BillingStatus {
  orgId: string;
  plan: PlanCode;
  month: string;
  features: FeatureFlags;
  usage: {
    analyze: { used: number; limit: number; remaining: number };
    generate_fix: { used: number; limit: number; remaining: number };
  };
}

const BILLING_STATE_PATH = path.join(process.cwd(), "data", "billing-state.json");

const PLAN_PRESETS: Record<PlanCode, Entitlement> = {
  free: {
    plan: "free",
    limits: { analyze: 25, generate_fix: 100 },
    features: {
      personalization: false,
      dashboard: true,
      jira: false,
    },
  },
  pro: {
    plan: "pro",
    limits: { analyze: 1000, generate_fix: 5000 },
    features: {
      personalization: true,
      dashboard: true,
      jira: true,
    },
  },
  enterprise: {
    plan: "enterprise",
    limits: { analyze: 100000, generate_fix: 500000 },
    features: {
      personalization: true,
      dashboard: true,
      jira: true,
    },
  },
};

const DEFAULT_STATE: BillingState = {
  orgByProject: {
    "demo-project": "demo-org",
  },
  entitlements: {
    "demo-org": PLAN_PRESETS.free,
  },
  usage: {},
};

function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeOrgId(projectId: string): string {
  return `org-${projectId.replace(/[^a-zA-Z0-9-_]/g, "-")}`;
}

async function readBillingState(): Promise<BillingState> {
  try {
    const raw = await readFile(BILLING_STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as BillingState;
    return {
      orgByProject: parsed.orgByProject ?? {},
      entitlements: parsed.entitlements ?? {},
      usage: parsed.usage ?? {},
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeBillingState(state: BillingState): Promise<void> {
  await writeFile(BILLING_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function ensureContext(state: BillingState, projectId: string): { orgId: string; entitlement: Entitlement } {
  const existingOrgId = state.orgByProject[projectId];
  const orgId = existingOrgId ?? normalizeOrgId(projectId);

  if (!existingOrgId) {
    state.orgByProject[projectId] = orgId;
  }

  const entitlement = state.entitlements[orgId] ?? PLAN_PRESETS.free;
  state.entitlements[orgId] = entitlement;

  return { orgId, entitlement };
}

function ensureUsageCounter(state: BillingState, month: string, orgId: string): UsageCounter {
  if (!state.usage[month]) {
    state.usage[month] = {};
  }

  if (!state.usage[month][orgId]) {
    state.usage[month][orgId] = { analyze: 0, generate_fix: 0 };
  }

  return state.usage[month][orgId];
}

export async function guardUsage(projectId: string, action: BillableAction): Promise<GuardResult> {
  const state = await readBillingState();
  const { orgId, entitlement } = ensureContext(state, projectId);
  const month = currentMonthKey();
  const usage = ensureUsageCounter(state, month, orgId);

  const used = usage[action];
  const limit = entitlement.limits[action];
  const remaining = Math.max(0, limit - used);

  await writeBillingState(state);

  if (used >= limit) {
    return {
      allowed: false,
      orgId,
      plan: entitlement.plan,
      used,
      limit,
      remaining: 0,
      features: entitlement.features,
      reason: "limit_reached",
    };
  }

  return {
    allowed: true,
    orgId,
    plan: entitlement.plan,
    used,
    limit,
    remaining,
    features: entitlement.features,
  };
}

export async function incrementUsage(projectId: string, action: BillableAction): Promise<void> {
  const state = await readBillingState();
  const { orgId } = ensureContext(state, projectId);
  const month = currentMonthKey();
  const usage = ensureUsageCounter(state, month, orgId);

  usage[action] += 1;
  await writeBillingState(state);
}

export async function getBillingStatus(projectId: string): Promise<BillingStatus> {
  const state = await readBillingState();
  const { orgId, entitlement } = ensureContext(state, projectId);
  const month = currentMonthKey();
  const usage = ensureUsageCounter(state, month, orgId);

  await writeBillingState(state);

  const analyzeLimit = entitlement.limits.analyze;
  const generateFixLimit = entitlement.limits.generate_fix;

  return {
    orgId,
    plan: entitlement.plan,
    month,
    features: entitlement.features,
    usage: {
      analyze: {
        used: usage.analyze,
        limit: analyzeLimit,
        remaining: Math.max(0, analyzeLimit - usage.analyze),
      },
      generate_fix: {
        used: usage.generate_fix,
        limit: generateFixLimit,
        remaining: Math.max(0, generateFixLimit - usage.generate_fix),
      },
    },
  };
}
