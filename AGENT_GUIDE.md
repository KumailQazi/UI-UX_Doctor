# Agent Guide — UI/UX Doctor
**Date:** 2026-04-01  
**POC:** Product/Engineering Team  
**TL;DR:** This guide documents the runtime agents, control/orchestration components, and best usage patterns. `AGENTS_ROLES.md` is documentation-only and has no runtime effect unless explicitly wired into code.

---

## 1) Does `AGENTS_ROLES.md` work at runtime?

Short answer: **No (not currently).**

- File exists: `AGENTS_ROLES.md`
- Current codebase search shows **no imports/references** to `AGENTS_ROLES.md` (or `agent_roles`) in `app/` or `lib/`.
- That means it is a **human/process guide**, not an executable config.

### Recommendation
- Keep it for onboarding and role clarity.
- If you want runtime behavior from role definitions, create a structured config (`.json`/`.ts`) and load it explicitly in route/agent logic.

---

## 2) Primary runtime AI agents

## Vision Analyst Agent
- **Implementation:** `lib/visionAnalystAgent.ts`
- **Called from:** `POST /api/analyze` (`app/api/analyze/route.ts`)
- **Input:** frames + session metadata
- **Output:** `Issue[]` (`dead_click`, `mobile_hidden_cta`, severity/confidence/evidence)
- **Best use:**
  - Send high-signal frames (interaction windows), not all frames.
  - Keep schema-constrained output.
  - Use routed model from `modelRouter`.

## Frontend Fix Agent
- **Implementation:** `lib/frontendFixAgent.ts`
- **Called from:** `POST /api/generate-fix` (`app/api/generate-fix/route.ts`)
- **Input:** issue + team preferences + optional component context
- **Output:** diagnosis, fixPlan, patched React/Tailwind, riskNotes, confidence
- **Best use:**
  - Run per issue (one-at-a-time).
  - Provide existing component code/context whenever possible.
  - Enforce accessibility and minimal/surgical diff constraints.

## Preference Memory Agent
- **Implementation:** `lib/preferenceMemoryAgent.ts`
- **Called from:** `POST /api/feedback` (`app/api/feedback/route.ts`)
- **Input:** feedback payload + existing preferences
- **Output:** updated preference list
- **Best use:**
  - Trigger only when notes are present.
  - Deduplicate periodically.
  - Resolve contradictory preferences in a governance pass.

---

## 3) Orchestration/control components (implicit agents)

## Role Registry + Runtime Role Agents
- **Files:** `lib/agentRoles.ts`, `lib/uiSurgeonAgent.ts`, `lib/aiRadiologistAgent.ts`, `lib/surgicalAssistantAgent.ts`, `lib/leadSurgeonAgent.ts`
- **Role:** Typed runtime role definitions and role-context helpers used by AI agents/prompts.
- **Current usage:**
  - `visionAnalystAgent` uses AI Radiologist role context
  - `frontendFixAgent` uses UI Surgeon role context
  - `preferenceMemoryAgent` uses Surgical Assistant role context
  - `leadSurgeonAgent` powers prioritization logic

## Model Router
- **File:** `lib/modelRouter.ts`
- **Role:** Select model by task, plan, and issue risk.
- **Current policy (summary):**
  - vision: free → `gpt-4o-mini`, paid → `gpt-4o`
  - fix: free → `gpt-4o-mini`; paid escalates risky issues to `claude-3-5-sonnet-20240620`
  - preference: `gpt-4o-mini`

## Provider Client Layer
- **File:** `lib/aiClient.ts`
- **Role:** OpenAI/Anthropic client access + provider detection + safe JSON parsing.

## Usage/Billing Gate
- **File:** `lib/billing.ts`
- **Role:** Enforce plan limits before expensive model calls.

## LLM Health Check
- **Route:** `GET /api/health/llm` (`app/api/health/llm/route.ts`)
- **Role:** Runtime readiness status (provider keys, required providers, routed model map by plan).

## Lead Surgeon Prioritization
- **Route:** `POST /api/prioritize` (`app/api/prioritize/route.ts`)
- **Role:** Scope-gate decisions (`BUILD`/`PARK`) using the 4-check framework from `AGENTS_ROLES.md`.

**Example request**
```bash
curl -X POST http://localhost:3000/api/prioritize \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "demo-project",
    "featureName": "Smart CTA auto-layout",
    "summary": "Auto-adjust CTA position for mobile checkout screens.",
    "checks": {
      "demosIn30Seconds": true,
      "showsDefensibility": true,
      "hasVisibleBusinessImpact": true,
      "buildableInUnderOneHour": false
    }
  }'
```

**Example response**
```json
{
  "projectId": "demo-project",
  "agent": "lead-surgeon",
  "featureName": "Smart CTA auto-layout",
  "summary": "Auto-adjust CTA position for mobile checkout screens.",
  "decision": "BUILD",
  "yesCount": 3,
  "threshold": 3,
  "checklist": [
    { "key": "demosIn30Seconds", "question": "Does it demo in < 30 seconds?", "passed": true },
    { "key": "showsDefensibility", "question": "Does it show defensibility (data moat, learning)?", "passed": true },
    { "key": "hasVisibleBusinessImpact", "question": "Does it have visible business impact ($$ metric)?", "passed": true },
    { "key": "buildableInUnderOneHour", "question": "Can it be built in < 1 hour?", "passed": false }
  ],
  "rationale": "Feature passed 3/4 checks (threshold 3). Prioritize for near-term implementation."
}
```

## Scoring/Ranking + Heatmap Enrichment
- **Files:** `lib/scoring.ts`, `app/api/analyze/route.ts`
- **Role:** Rank issues and produce actionable visual hotspot context.

---

## 4) Best-practice execution flow

1. **Analyze** session (`/api/analyze`)  
2. **Rank + shortlist** top issues  
3. **Generate fix** for selected issue (`/api/generate-fix`)  
4. **Collect feedback** (`/api/feedback`)  
5. **Update preferences** and improve next fix cycle  
6. **Monitor readiness** via `/api/health/llm` and usage via billing status

---

## 5) Common pitfalls and guardrails

- Sending too many/low-signal frames → higher latency + lower precision.
- Generating fixes without component context → generic output quality drops.
- Not validating LLM JSON shape → brittle runtime behavior.
- Allowing unbounded preferences growth → noisy/conflicting rules.
- Skipping readiness checks before deploy → avoidable runtime failures.

---

## 6) Suggested next upgrade (if role docs should affect runtime)

If you want `AGENTS_ROLES.md` to “work,” implement:

- `lib/agentRoles.ts` (typed runtime roles/capabilities),
- optional per-project role policy in data store,
- route-level injection of role policy into prompts/model routing.

That turns role docs from static guidance into enforceable behavior.
