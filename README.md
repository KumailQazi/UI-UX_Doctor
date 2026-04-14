# UI/UX Doctor

Visual UI debugger for fast-moving product teams.  
UI/UX Doctor analyzes session evidence, detects high-friction UI patterns, and generates accessible React/Tailwind prescriptions.

## Demo Video https://www.loom.com/share/6093d641ea0f49f6a3830cf32a654e60

## ✨ What it does

- Detects high-friction UI issues from uploaded session data
- Shows visual evidence with:
  - frustration timeline
  - heatmap overlays
  - before/after UI comparison
- Generates UI/UX prescriptions (React + Tailwind + risk notes)
- Captures accept/reject feedback and learns team preferences
- Tracks analytics in dashboard:
  - acceptance trend
  - remaining issues
  - estimated recovery in USD
  - learning memory
- Enforces plan usage limits (Analyze credits + UI/UX credits)

---

## 🧱 Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- AdaL CLI (AI agent framework)
- ESLint

---

## 🚀 Getting Started

### 1) Install dependencies
```bash
npm install
```

### 2) Run dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3) Production checks
```bash
npm run lint
npm run build
```

### 4) Environment setup
Copy the example config and adjust values for your environment:

```bash
cp .env.example .env.local
```

Key variables:
- `NEXT_PUBLIC_DEFAULT_PROJECT_ID` — default project context in UI/API fallbacks
- `DEMO_MODE` — enables seeded demo behavior
- `STRICT_TWO_ISSUES` — caps analyze output to top 2 issues
- `UIUX_DOCTOR_*` — data paths and plan limits (free/pro/enterprise)

---

## 🧪 Demo Flow

1. Go to `/upload`
2. Upload sample session JSON (or run demo mode)
3. Review issues in `/results/[jobId]`
4. Generate and accept/reject prescriptions
5. Open `/dashboard` for analytics and learned preferences
6. Click issue links from dashboard to jump to issue-focused results

---

## 📌 Key Routes

### App pages
- `/` — Landing
- `/upload` — Session upload
- `/results/[jobId]` — Analysis + prescriptions
- `/dashboard` — Analytics and usage

### API routes
- `POST /api/analyze`
- `POST /api/generate-fix`
- `POST /api/feedback`
- `POST /api/prioritize`
- `GET /api/dashboard`
- `GET /api/billing/status`
- `GET /api/health/llm`

---

## 🎯 Lead Surgeon Prioritization (`/api/prioritize`)

Use this endpoint to decide whether a feature should be built now or parked, using the 4-check scope framework from `AGENTS_ROLES.md`.

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

### Example response
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

---

## 🩺 LLM Health Check

Use this endpoint to verify model/provider readiness before sending production traffic.

```bash
curl -i http://localhost:3000/api/health/llm
```

### Example: ready (HTTP 200)
```json
{
  "ready": true,
  "demoMode": false,
  "missingProviders": [],
  "providerStatus": {
    "openai": { "required": true, "ready": true },
    "anthropic": { "required": true, "ready": true }
  },
  "modelsByPlan": {
    "free": {
      "vision": "gpt-4o-mini",
      "fixDefault": "gpt-4o-mini",
      "fixEscalated": "gpt-4o-mini",
      "preference": "gpt-4o-mini"
    },
    "pro": {
      "vision": "gpt-4o",
      "fixDefault": "gpt-4o-mini",
      "fixEscalated": "claude-3-5-sonnet-20240620",
      "preference": "gpt-4o-mini"
    },
    "enterprise": {
      "vision": "gpt-4o",
      "fixDefault": "gpt-4o-mini",
      "fixEscalated": "claude-3-5-sonnet-20240620",
      "preference": "gpt-4o-mini"
    }
  }
}
```

### Example: not ready (HTTP 503)
```json
{
  "ready": false,
  "demoMode": true,
  "missingProviders": ["openai", "anthropic"]
}
```

---

## 📂 Presentation Decks

Located in project root:

- `UI_UX_Doctor_MVP_Presentation.pptx`

---

## 🔐 Notes

- Do **not** commit `node_modules/`, `.next/`, or `.env*`.
- Keep demo/customer data sanitized before sharing publicly.

---

## 📄 License

MIT (recommended for hackathon/open-source sharing).
