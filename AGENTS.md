# AGENTS.md

## Project
**UI/UX Doctor** — Visual UI Debugger for web apps  
Goal: Analyze user session evidence, detect high-friction UX issues, and generate safe React/Tailwind fixes with measurable business impact.

---

## Primary Agents

### 1) Vision Analyst Agent
**Purpose:** Detect visual UX issues from session evidence (JSON events, optional recording context).  
**Inputs:** Session events, viewport metadata, optional timeline/click context.  
**Outputs:** Structured issue objects with evidence and confidence.

**Allowed issue classes (MVP):**
- `dead_click` — element appears clickable but is non-interactive
- `mobile_hidden_cta` — key CTA is below fold/obscured on mobile

---

### 2) Frontend Fix Agent
**Purpose:** Produce minimal, production-safe code fixes.  
**Inputs:** Issue object, optional component context, learned team preferences.  
**Outputs:** Diagnosis, fix plan, React patch, Tailwind/CSS patch, risk notes, confidence.

**Constraints:**
- Surgical edits only
- Preserve existing behavior unless required for fix
- Accessibility-first (semantic elements, keyboard/focus states, ARIA where relevant)

---

### 3) Preference Memory Agent
**Purpose:** Learn project/team fix preferences from feedback.  
**Inputs:** Accept/reject outcomes, notes, edited fixes.  
**Outputs:** Ranked preferences injected into future fix generation.

**Examples of learned preferences:**
- “Use sticky mobile CTA for checkout”
- “Prefer high-contrast focus-visible states”
- “Avoid non-semantic clickable containers”

---

## API Contracts (MVP)

### `POST /api/analyze`
Returns:
- `jobId`
- `projectId`
- `issues[]` with:
  - `issueId`
  - `type`
  - `severity`
  - `summary`
  - `evidence[]`
  - `confidence`
  - `heatmapPoints[]` (when available)
  - `peakLabel`

### `POST /api/generate-fix`
Returns:
- `diagnosis`
- `fixPlan[]`
- `patchedCode.react`
- `patchedCode.cssOrTailwind`
- `riskNotes[]`
- `confidence`
- `personalizedNote` (optional)

### `POST /api/feedback`
Stores:
- `projectId`
- `issueId`
- `fixAccepted`
- `editedByUser`
- `notes`

### Read APIs
- `GET /api/dashboard`
- `GET /api/billing/status`

---

## Runtime Configuration

Configuration is centralized through:
- `lib/constants.ts` (app name, default project ID, session key helper)
- `lib/env.ts` (runtime flags + data file paths)
- `lib/pricingConfig.ts` (plan limits/features)

Environment template:
- `.env.example` → copy to `.env.local`

Key flags:
- `DEMO_MODE`
- `STRICT_TWO_ISSUES`
- `NEXT_PUBLIC_DEFAULT_PROJECT_ID`
- `UIUX_DOCTOR_*` (data paths and plan limits)

---

## Operating Rules

1. **Precision > Recall:** Return fewer, higher-confidence issues.
2. **No unsupported root-cause claims:** Only assert what evidence supports.
3. **Max 3 issues per run** (or 2 when `STRICT_TWO_ISSUES=true`).
4. **Accessibility is mandatory** in generated fixes.
5. **Business impact framing:** tie issue outcomes to conversion/support impact.
6. **Structured JSON outputs** for downstream rendering.

---

## Severity Heuristic (MVP)

- **High:** Blocks core task (checkout/login/submit), repeated failed interactions
- **Medium:** Significant friction but workaround exists
- **Low:** Cosmetic/minor discoverability issue

---

## Demo Mode Flags

- `DEMO_MODE=true` — enables seeded fallback defaults
- `STRICT_TWO_ISSUES=true` — keeps output focused/judge-friendly
- `SHOW_PERSONALIZATION=true` — UI flag for highlighting learned preferences

---

## Success Metrics

- Time to first useful issue
- Fix acceptance rate
- Repeated issue reduction over time
- Friction trend per flow/screen
- Estimated recovery impact visibility

---

## Security & Privacy

- Do not retain raw session recordings longer than needed
- Redact PII in logs and outputs
- Isolate project data by `projectId`
- Never commit secrets (`.env.local`, credentials, API keys)
