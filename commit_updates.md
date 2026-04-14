# Commit Updates Log

> Append one new dated section per day with shipped updates and commit-ready messages.

## 2026-04-01

### Updates shipped today
- Added centralized model routing in `lib/modelRouter.ts`:
  - `vision`: free → `gpt-4o-mini`, paid → `gpt-4o`
  - `fix`: free → `gpt-4o-mini`, paid escalates to `claude-3-5-sonnet-20240620` for high-severity/low-confidence issues
  - `preference`: `gpt-4o-mini`
- Wired routed model selection into API routes:
  - `app/api/analyze/route.ts`
  - `app/api/generate-fix/route.ts`
  - `app/api/feedback/route.ts`
- Added real provider integration with safe fallbacks:
  - New shared helper: `lib/aiClient.ts` (OpenAI + Anthropic clients, provider detection, safe JSON parsing)
  - Updated agents:
    - `lib/visionAnalystAgent.ts`
    - `lib/frontendFixAgent.ts`
    - `lib/preferenceMemoryAgent.ts`
- Added runtime readiness endpoint:
  - `GET /api/health/llm` at `app/api/health/llm/route.ts`
  - Reports provider/key readiness and model routing by plan; returns `200` when ready, `503` otherwise
- Updated docs:
  - Added `ANTHROPIC_API_KEY` to `.env.example`
  - Added LLM health-check section and curl examples to `README.md`
- Validation:
  - Ran `npm run lint` successfully after integration changes

### Commit message (recommended)
feat: add model routing, provider-backed LLM calls, and health-check endpoint

### Commit body (optional)
- introduce plan-aware model routing for analyze/fix/feedback flows
- wire OpenAI/Anthropic SDK calls with schema-safe JSON parsing and fallbacks
- add /api/health/llm for deployment readiness checks
- document env keys and health-check usage in README

### Commit message (short-form copy/paste)
feat: add routed LLM providers + health-check API

- add modelRouter-based plan/severity routing for analyze/fix/feedback
- integrate OpenAI/Anthropic SDK calls with safe JSON parsing and fallbacks
- add /api/health/llm and update README + .env.example

---

## Competitive Benchmark Reference (2026-04-01)

### Purpose
Reference set for product benchmarking against tools adjacent to UI/UX Doctor:
- session replay + frustration detection
- product analytics with replay context
- visual regression and trace tooling
- AI-assisted fix/code generation workflows

### Competitor map (with repos + documentation links)
| Tool | Category | OSS / Commercial | Website | Documentation | GitHub Repo |
|---|---|---|---|---|---|
| OpenReplay | Session replay | OSS | https://openreplay.com | https://docs.openreplay.com/ | https://github.com/openreplay/openreplay |
| PostHog | Product analytics + replay | OSS | https://posthog.com | https://posthog.com/docs | https://github.com/PostHog/posthog |
| LogRocket | Session replay + AI insights | Commercial | https://logrocket.com | https://docs.logrocket.com/ | No public repo |
| FullStory | UX insights / frustration signals | Commercial | https://fullstory.com | https://help.fullstory.com/hc/en-us | No public repo |
| Sentry | Error tracking + replay context | OSS core/commercial cloud | https://sentry.io | https://docs.sentry.io/ | https://github.com/getsentry/sentry |
| BackstopJS | Visual regression | OSS | https://garris.github.io/BackstopJS/ | https://github.com/garris/BackstopJS#readme | https://github.com/garris/BackstopJS |
| Playwright | E2E + visual snapshots/traces | OSS | https://playwright.dev | https://playwright.dev/docs/intro | https://github.com/microsoft/playwright |
| Mabl | AI testing | Commercial | https://www.mabl.com | https://help.mabl.com/hc/en-us | No public repo |
| Sweep | AI coding agent | OSS/commercial | https://sweep.dev | https://docs.sweep.dev/ | https://github.com/sweepai/sweep |
| v0 | AI UI generation | Commercial | https://v0.dev | https://v0.dev/docs | No public repo |
| PureCode AI | AI UI assistant | Commercial | https://purecode.ai | https://docs.purecode.ai/ | No public repo |
| Decipher (session replay analyzer) | AI replay analysis | Commercial/adjacent | https://getdecipher.com | Not publicly documented | https://github.com/decipherai/session-replay-analyzer |

### Adoption + user feedback snapshot
| Tool | Adoption signals | User praise (common) | User complaints (common) | Confidence |
|---|---|---|---|---|
| PostHog | Large OSS + community traction | all-in-one stack, dev-first workflows | pricing/volume complexity, script overhead concerns | High |
| Sentry | Very strong OSS + enterprise adoption | error-to-replay context, broad integrations | alert noise, onboarding complexity | High |
| Playwright | Very high OSS adoption | stability and trace viewer quality | learning curve for smaller QA teams | High |
| OpenReplay | Healthy OSS signal | self-hosting/privacy and replay detail | self-hosting setup overhead | High |
| LogRocket | Strong commercial customer signals | AI summaries and debugging UX | pricing + retention limits on lower tiers | High |
| FullStory | Enterprise footprint | frustration signals and search capabilities | cost and steeper learning curve | Medium |
| BackstopJS | Stable OSS niche adoption | simple CI visual diff workflows | dynamic-content false positives | High |
| Sweep | Moderate OSS traction | fast issue-to-PR loop on small tasks | weaker performance on complex repo logic | Medium |
| Mabl | Commercial case-study adoption | self-healing test maintenance savings | price + black-box behavior concerns | Medium |
| v0 | High product usage momentum | rapid Tailwind/React prototyping quality | weaker for legacy refactor workflows | Medium |
| PureCode AI | Early public traction | design-system-oriented generation | limited transparent public feedback | Low |
| Decipher | Early-stage footprint | replay-to-root-cause narrative | smaller feature maturity vs established tools | Low |

### Top 6 for deep benchmark
1. PostHog — strongest integrated analytics+replay OSS reference.
2. OpenReplay — best self-host/privacy-first replay architecture benchmark.
3. LogRocket — benchmark AI insight quality and triage UX.
4. Playwright — benchmark traceability and regression automation.
5. Sentry — benchmark error-context + replay correlation.
6. FullStory — benchmark frustration-signal product UX.

### Weighted comparative scoring model (recommended)
Use this for quarterly benchmarking and roadmap tradeoff decisions:
- Feature fit to UI/UX Doctor: **30%**
- Adoption strength: **20%**
- User feedback sentiment: **20%**
- Benchmarkability (public repo/docs/transparency): **15%**
- Cost/operational clarity: **15%**

### Reusable benchmark template (fill per quarter)
| Tool | Feature Fit (30) | Adoption (20) | Feedback (20) | Benchmarkability (15) | Cost/Ops (15) | Total (100) | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| PostHog |  |  |  |  |  |  |  |
| OpenReplay |  |  |  |  |  |  |  |
| LogRocket |  |  |  |  |  |  |  |
| Playwright |  |  |  |  |  |  |  |
| Sentry |  |  |  |  |  |  |  |
| FullStory |  |  |  |  |  |  |  |

### Lead Surgeon Prioritization API Reference (`/api/prioritize`)
Use this to quickly scope-gate features as BUILD vs PARK.

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

Example response (summary):
```json
{
  "decision": "BUILD",
  "yesCount": 3,
  "threshold": 3,
  "agent": "lead-surgeon"
}
```

---
## 2026-04-14

### Updates shipped today
- Fixed `lib/visionAnalystAgent.ts` simulated fallback behavior to return the required two mock issues (`dead_click` and `mobile_hidden_cta`) for the MVP Demo Mode.
- Updated `.gitignore` to explicitly ignore `Obsidian_Vault/`.

### Commit message (recommended)
fix: ensure MVP mock agent returns two issues and update gitignore

### Commit body (optional)
- update vision analyst agent fallback behavior to include secondary mock issue
- ignore Obsidian_Vault system memory folder locally
