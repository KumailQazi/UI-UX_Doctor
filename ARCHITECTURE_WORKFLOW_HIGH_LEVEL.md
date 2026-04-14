# UI/UX Doctor — High-Level Architecture Workflow

**Date:** 2026-03-12  
**POC:** AdaL  
**TL;DR:** Upload session data → analyze friction issues → generate safe UI fixes → collect feedback → learn team preferences → track outcomes in dashboard, all controlled via centralized runtime + pricing config.

## High-Level Workflow Diagram

```mermaid
flowchart TD
    A[User uploads session JSON/video<br/>/upload] --> B[Frontend UploadPanel]
    B --> B1[Constants layer<br/>lib/constants.ts]
    B1 --> C[POST /api/analyze]

    C --> C1[Runtime config<br/>lib/env.ts]
    C1 --> C2[DEMO_ISSUES_PATH / STRICT_TWO_ISSUES]
    C --> D[Vision Analyst logic]
    D --> E[Issue detection + evidence + confidence]
    E --> F[Job output: issues[] + severity + business impact]
    F --> G[Results page /results/[jobId]]

    G --> H[User clicks Generate Fix]
    H --> I[POST /api/generate-fix]
    I --> I1[Preferences path via env config]
    I --> J[Frontend Fix Agent logic]
    J --> K[Minimal React/Tailwind patch + risk notes + checklist]
    K --> L[Before/After UI + slider + heatmap + diagnostics]

    L --> M[User accepts/rejects fix]
    M --> N[POST /api/feedback]
    N --> O[Preference Memory Agent]
    O --> P[Store team preferences + patterns]
    P --> I

    C --> Q[Billing/Usage Guard<br/>lib/billing.ts]
    I --> Q
    N --> Q
    Q --> Q1[Plan limits from lib/pricingConfig.ts]
    Q --> R[Plan limits + usage tracking + status badges]

    F --> S[Dashboard /dashboard]
    L --> S
    N --> S
    S --> T[Analytics: friction trends, fix acceptance, ROI, memory insights]

    U[.env.local from .env.example] --> B1
    U --> C1
    U --> Q1
```

## Core Layers (Summary)

1. **Frontend (Next.js App Router)**
   - `/upload` for intake
   - `/results/[jobId]` for issue/fix experience
   - `/dashboard` for analytics and deep-links
   - Shared defaults/keys from `lib/constants.ts`

2. **API Layer**
   - `POST /api/analyze`
   - `POST /api/generate-fix`
   - `POST /api/feedback`
   - `GET /api/dashboard`, `GET /api/billing/status`

3. **Agentic Core**
   - Vision Analyst Agent
   - Frontend Fix Agent
   - Preference Memory Agent

4. **Config + Data Controls**
   - Runtime env/config in `lib/env.ts`
   - Plan/limit config in `lib/pricingConfig.ts`
   - Session evidence + issue payloads + preference memory
   - Usage/billing guardrails per plan
