import "server-only";
import { getAgentRole } from "./agentRoles";

export function getUiSurgeonSystemContext(): string {
  return getAgentRole("ui-surgeon").systemContext;
}
