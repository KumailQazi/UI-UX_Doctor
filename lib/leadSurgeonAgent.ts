import "server-only";
import { getAgentRole } from "./agentRoles";

export function getLeadSurgeonSystemContext(): string {
  return getAgentRole("lead-surgeon").systemContext;
}

export function shouldBuildFeature(answerCount: number): boolean {
  return answerCount >= 3;
}
