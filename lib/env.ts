import "server-only";
import path from "node:path";

function readBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return defaultValue;
  }

  return raw === "true";
}

const DATA_DIR = process.env.UIUX_DOCTOR_DATA_DIR?.trim() || path.join(process.cwd(), "data");

export const RUNTIME_ENV = {
  demoMode: readBoolean("DEMO_MODE", false),
  strictTwoIssues: readBoolean("STRICT_TWO_ISSUES", false),
  dataDir: DATA_DIR,
  demoIssuesPath:
    process.env.UIUX_DOCTOR_DEMO_ISSUES_PATH?.trim() || path.join(DATA_DIR, "demo-issues.json"),
  preferencesPath:
    process.env.UIUX_DOCTOR_PREFERENCES_PATH?.trim() || path.join(DATA_DIR, "preferences.json"),
  billingStatePath:
    process.env.UIUX_DOCTOR_BILLING_STATE_PATH?.trim() || path.join(DATA_DIR, "billing-state.json"),
} as const;

export const DEMO_MODE = RUNTIME_ENV.demoMode;
export const STRICT_TWO_ISSUES = RUNTIME_ENV.strictTwoIssues;
export const DEMO_ISSUES_PATH = RUNTIME_ENV.demoIssuesPath;
export const PREFERENCES_PATH = RUNTIME_ENV.preferencesPath;
export const BILLING_STATE_PATH = RUNTIME_ENV.billingStatePath;
