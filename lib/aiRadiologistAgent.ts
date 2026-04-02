import "server-only";
import { getAgentRole } from "./agentRoles";

export function getAiRadiologistSystemContext(): string {
  return getAgentRole("ai-radiologist").systemContext;
}
