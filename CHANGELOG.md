# Changelog

All notable changes to **UI/UX Doctor** are documented in this file.

## [2026-03-12] - Production Hardening + Docs Update

### Added
- `lib/constants.ts` for centralized app defaults and shared client/server constants:
  - `APP_NAME`
  - `DEFAULT_PROJECT_ID`
  - `getSessionStorageKey(projectId)`
- `lib/env.ts` for typed runtime configuration:
  - `DEMO_MODE`
  - `STRICT_TWO_ISSUES`
  - configurable data file paths (`UIUX_DOCTOR_*`)
- `lib/pricingConfig.ts` for plan-tier limits/features with env-overridable caps.
- `.env.example` with all runtime/pricing keys and safe local defaults.
- `AGENTS.md` aligned to current architecture and operating model.
- Sample upload datasets for demo/testing:
  - `sample-upload-dead-click-checkout.json`
  - `sample-upload-mobile-hidden-cta.json`
  - `sample-upload-mixed-friction.json`
  - `sample-upload-low-confidence-noise.json`
- Architecture docs:
  - `ARCHITECTURE_WORKFLOW_HIGH_LEVEL.md`
  - `ARCHITECTURE_WORKFLOW_DETAILED.md`

### Changed
- Replaced scattered hardcoded defaults with centralized config across:
  - `app/api/analyze/route.ts`
  - `app/api/dashboard/route.ts`
  - `app/api/billing/status/route.ts`
  - `app/api/generate-fix/route.ts`
  - `app/results/[jobId]/page.tsx`
  - `app/dashboard/page.tsx`
  - `app/page.tsx`
  - `components/UploadPanel.tsx`
  - `lib/billing.ts`
- Updated `README.md` with environment setup instructions (`.env.example` → `.env.local`).
- Updated architecture workflow docs to reflect config bootstrap and pricing/runtime wiring.

### Fixed
- Resolved `/upload` instability by applying hydration-safe client mount handling in `UploadPanel`.
- Removed invalid server-component dynamic import pattern (`next/dynamic` with `ssr: false`) and restored build-safe rendering.
- Cleared Turbopack dev cache lock issue and validated stable rebuild path.

### Validation
- Verified with successful production build (`npm run build`) after refactors.
