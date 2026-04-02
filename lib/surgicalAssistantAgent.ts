import "server-only";
import { getAgentRole } from "./agentRoles";

export function getSurgicalAssistantSystemContext(): string {
  return getAgentRole("surgical-assistant").systemContext;
}
