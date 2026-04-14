# UI/UX Doctor — Detailed Architecture Workflow

**Date:** 2026-03-12  
**POC:** AdaL  
**TL;DR:** The system converts session evidence into high-confidence UI issues, generates minimal safe fixes, learns from feedback, and now runs through centralized environment + pricing configuration for production readiness.

## 1) End-to-End Detailed Workflow

```mermaid
flowchart LR
    subgraph Config_Initialization
      C0[.env.local based on .env.example] --> C1[lib/env.ts runtime config]
      C0 --> C2[lib/pricingConfig.ts plan limits]
      C0 --> C3[lib/constants.ts app defaults]
    end

    subgraph Intake
      U1[User opens /upload] --> U2[UploadPanel client UI]
      U2 --> U3[Select projectId + optional JSON/video]
      U3 --> U4[Store parsed session JSON in sessionStorage<br/>getSessionStorageKey(projectId)]
      U4 --> U5[Call /api/analyze]
    end

    subgraph Analyze
      A1[/api/analyze request validator/] --> A2[Billing/usage gate check via lib/billing.ts]
      A2 --> A3[Read limits/features from lib/pricingConfig.ts]
      A1 --> A4[Read data paths + STRICT_TWO_ISSUES from lib/env.ts]
      A4 --> A5[Load issues from DEMO_ISSUES_PATH]
      A5 --> A6[Issue scoring + ranking + response shaping]
      A6 --> A7[Return jobId + issues + evidence + confidence]
    end

    subgraph Results_Experience
      R1[/results/[jobId] data load/] --> R2[Render issue cards + evidence]
      R2 --> R3[Show heatmap overlays + source badges]
      R3 --> R4[User requests fix]
      R4 --> R5[Call /api/generate-fix]
      R5 --> R6[Load PREFERENCES_PATH via lib/env.ts]
      R6 --> R7[Render diagnosis + fix plan + patched React/CSS]
      R7 --> R8[Before/After compare, slider, diagnostics]
    end

    subgraph Feedback_Learning
      F1[User accept/reject + notes] --> F2[POST /api/feedback]
      F2 --> F3[Persist outcome and edited preference signals]
      F3 --> F4[Preference Memory ranking update]
      F4 --> F5[Inject preferences into next fix generation]
    end

    subgraph Analytics_Monetization
      D1[/dashboard aggregates/] --> D2[Friction trend + acceptance rate]
      D2 --> D3[Business impact cards]
      D3 --> D4[Issue deep-links Open issue ↗]
      D4 --> D5[Plan badges + usage status]
    end

    C1 --> A4
    C2 --> A3
    C3 --> U2
    U5 --> A1
    A7 --> R1
    R8 --> F1
    F5 --> R5
    A2 --> D5
    F2 --> D1
```

## 2) Request/Response Contract Flow (MVP)

### A. `POST /api/analyze`
**Input**
- `projectId` (falls back to `DEFAULT_PROJECT_ID` from constants)
- optional `sessionData` (events, viewport metadata)

**Processing**
1. Validate payload
2. Check plan limits / usage (`lib/billing.ts`)
3. Read runtime switches (`STRICT_TWO_ISSUES`) and paths (`DEMO_ISSUES_PATH`) from `lib/env.ts`
4. Run issue detection/ranking and return top actionable issues

**Output**
- `jobId`
- `issues[]` with:
  - `type` (`dead_click`, `mobile_hidden_cta`)
  - `severity` (`high|medium|low`)
  - `summary`
  - `evidence[]`
  - `confidence`

---

### B. `POST /api/generate-fix`
**Input**
- `projectId`
- `issueId` / issue payload
- optional preference context

**Processing**
1. Validate/gate request
2. Build diagnosis from issue evidence only
3. Load project preferences from `PREFERENCES_PATH` (`lib/env.ts`)
4. Generate minimal React patch + CSS/Tailwind patch + risk notes

**Output**
- `diagnosis`
- `fixPlan[]`
- `patchedCode.react`
- `patchedCode.cssOrTailwind`
- `riskNotes[]`
- `confidence`

---

### C. `POST /api/feedback`
**Input**
- `projectId`
- `issueId`
- `fixAccepted`
- `editedByUser`
- `notes`

**Processing**
1. Store explicit outcome
2. Extract preference signals
3. Update ranked preference memory for project/team

**Output**
- success acknowledgement
- updated memory metadata (optional)

## 3) Core Internal Decision Logic

### Severity Heuristic
- **High:** blocks core flow (checkout/login/submit) or repeated failed interactions
- **Medium:** significant friction with workaround
- **Low:** cosmetic/minor discoverability

### Precision Constraints
- Max 3 issues surfaced/run (or 2 when `STRICT_TWO_ISSUES=true`)
- No unsupported root-cause claims
- Confidence-thresholded ranking before display

### Accessibility Gate for Fixes
- Semantic elements preferred
- Keyboard/focus states preserved
- ARIA only where relevant
- Minimal behavioral change outside target fix

## 4) Data + Config Lifecycle (Practical)

1. **Runtime config bootstrap** from `.env.local` (`.env.example` template)
2. **Short-lived raw session data** for analysis
3. **Structured issue artifacts** retained for results/dashboard
4. **Feedback + preference memory** retained by `projectId`
5. **Billing/usage counters** updated per request path using configurable file path
6. **PII minimization** and project-level data isolation

## 5) Operational Flow in Demo/Hackathon Mode

- `DEMO_MODE=true` enables demo-seeded defaults
- `STRICT_TWO_ISSUES=true` keeps output judge-friendly
- `SHOW_PERSONALIZATION=true` (UI flag) highlights learned preferences in UI

## 6) Success Metrics Traceability

- **Time to first issue**: from upload submit to first issue render
- **Fix acceptance rate**: accepted / generated fixes
- **Repeated issue reduction**: trend over sessions
- **Friction score trend**: dashboard weekly movement
