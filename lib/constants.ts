export const APP_NAME = "UI/UX Doctor";

export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const DEFAULT_PROJECT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID?.trim() || "demo-project";

export function getSessionStorageKey(projectId: string): string {
  return `componentDoctorSessionData:${projectId}`;
}
