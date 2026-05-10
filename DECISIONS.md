# Sharp — Locked Decisions

Single source of truth for project-level decisions. Update when something changes; do not silently deviate.

## Tech stack (locked)

- **Framework**: Next.js 15 (App Router), TypeScript strict
- **Styling**: Tailwind CSS **v3.4** (not v4 — boring stack ships faster), shadcn/ui, dark mode default
- **Auth + DB**: Supabase, fresh project on the new publishable/secret key system, `@supabase/ssr`
- **Payments**: Stripe Checkout + Customer Portal, monthly subscription only, dashboard-created Price referenced via `STRIPE_PRICE_ID_PRO`
- **AI**: Anthropic SDK, model `claude-sonnet-4-6`, streaming
- **Sports data**: BallDontLie (NBA, free tier), The Odds API (props/odds)
- **Hosting**: Vercel
- **Package manager**: pnpm

## Runtime

- `/api/analyze` → **Node** runtime (long-lived stream + DB write at end)
- `/api/games`, `/api/odds` → **Edge** runtime (lightweight cache reads)

## Auth

- **Magic link only** (Supabase OTP email). No password flows.
- Google OAuth deferred to Phase 6 only if signup friction shows up in funnel data.

## Free tier

- **3 lifetime analyses**, not monthly. Easier to loosen than tighten.
- Schema column: `lifetime_analyses_used` (renamed from spec's `trial_analyses_used`).

## Sport scope

- Phase 3–4: **NBA only** live. MLB and NFL stubbed in UI as "Coming soon" disabled.
- Schema `sport` enum keeps `nba | nfl | mlb` for forward compatibility.

## Streaming

- **SSE** (`text/event-stream`) per spec. Not ND-JSON.

## Parlay parsing

- Sharp system prompt MUST emit a structured tail block after the prose:
  ```
  ---SHARP_META---
  {"confidence": 7, "recommendation_type": "parlay" | "no_play" | "monitor", "legs": [...], "kill_conditions": [...], "estimated_payout": "+285"}
  ---END_SHARP_META---
  ```
- Parser strips the block, validates with Zod, writes structured fields to `parlays`.
- Final schema finalized when the system prompt is pasted in.

## Stripe

- Test mode through Phase 5 demos. Switch to live only after.
- Price object created via dashboard, referenced by env var ID.

## Infrastructure

- **GitHub repo**: `sharp`, private, David's personal account
- **Supabase**: project name `sharp-prod`, region `us-east-1`
- **Domain**: deferred until Phase 5; Vercel preview URL through Phases 1–4
- **Logo**: text-only "Sharp" wordmark (Geist or Inter Display, weight ≥700, tight tracking) for Phase 1; commission a mark later

## Compliance (every page, day one)

Footer disclaimer on every page: `21+, not financial advice, gambling problem call 1-800-GAMBLER`.
Affiliate programs reject sites without it.

## Coding standards

- TypeScript strict, no `any` without `// @ts-expect-error` + reason
- Server Components by default; `'use client'` only when interactivity demands
- Zod for every API route input
- All Supabase queries through typed helpers (`supabase gen types`)
- Conventional commit messages, tag at the end of each phase
- No new npm packages outside the locked stack without approval
