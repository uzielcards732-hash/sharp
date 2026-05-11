# Sharp Build Progress

## Phase 1: Scaffold — COMPLETE
- Next.js 15.5.18 + Tailwind v3.4 + TypeScript scaffold working locally
- Landing page renders correctly in dark mode at localhost:3000
- Repo: github.com/uzielcards732-hash/sharp
- Project location: ~/code/sharp
- Tagged: phase-1-local
- Vercel: deployment exists but Hobby plan preview URL is auth-walled. Defer fix to Phase 5.

## Phase 2: Auth + Database — COMPLETE
- Supabase project: sharp-prod (ytkzchzauuartslbwxca, us-east-1)
- DB migration applied: profiles, parlays, affiliate_clicks tables + RLS + auto-create profile trigger
- @supabase/ssr + @supabase/supabase-js installed
- shadcn Button, Input, Card added
- Browser + server Supabase client helpers (lib/supabase/)
- Middleware: session refresh, protects /dashboard + /history, bounces logged-in from /login
- /login: magic link OTP form
- /auth/callback: PKCE code exchange → /dashboard
- /dashboard: server component showing email, plan, analyses used + sign-out
- End-to-end magic link flow verified locally
- Tagged: phase-2-local
- Note: callback route lives at app/auth/callback/ (not app/(auth)/callback/) — route groups don't add URL segments

## Phase 3: Analysis Loop + Dashboard UI — COMPLETE
- Migration 0002 applied: analyses table (new) + parlays restructured (legs/kill_conditions/estimated_payout/analysis_id replacing old columns)
- Migration lesson: Supabase SQL editor silently aborts on transaction rollback. Use BEGIN/COMMIT + sentinel SELECTs. Root cause was unnamed CHECK constraint (parlays_sport_check) blocking DROP COLUMN — must drop constraint before dropping column.
- @anthropic-ai/sdk installed, ANTHROPIC_API_KEY required in lib/env.ts
- lib/prompts/sharp-v1.ts: locked system prompt including juice rule (-125 threshold), LIVE MANAGEMENT section, anti-correlation examples, SHARP_META output contract
- lib/schemas/sharp-meta.ts: Zod discriminated union (PlayMetaSchema / NoPlayMetaSchema)
- /api/analyze: Node runtime, SSE, auth + limit check, Anthropic stream, ref-based prose cutoff at META_OPEN, DB writes, atomic increment
- Bearer token auth support added to route (for curl/scripts alongside cookie-based browser auth)
- Two-path smoke test verified: NO PLAY path (analyses row only, no parlay row) + PLAY path (analyses + parlays rows, FK linked, outcome: pending)
- components/analyze-form.tsx: sport selector (NBA live, MLB/NFL disabled), game context + question textareas, usage counter with pip indicators, upgrade CTA stub at limit
- components/parlay-card.tsx: streaming prose via ref-based DOM mutation (zero re-renders per token), structured card on complete (PLAY or NO PLAY), parse_failed banner, error + retry
- /dashboard: server component layout, full-width on mobile, 40/60 split on desktop
- End-to-end browser test passed: streaming, counter updates, limit state, MLB/NFL badges
- Tagged: phase-3-local
- Sharp boundary behavior verified in browser: 88% of line + quarter remaining + -115 = NO PLAY (juice rule fires). Single-leg play threshold is 90%+ at this price point. Documented for future prompt tuning.

## Phase 4 prep (pre-work before starting):
- Add dev-only counter reset path before Phase 4 testing (raw SQL in Supabase editor or admin route)
- max_tokens already set: 2048 in /api/analyze (no change needed)
- Phase 4 = Stripe wiring: subscription tier column + paid lookup replacing hardcoded FREE_LIMIT=3
- Phase 4 nice-to-have: prompt caching on Sharp system prompt (~85% input token reduction at scale)

## Decisions made:
- Free tier: 3 lifetime analyses
- Auth: magic link only
- NBA only for Phase 3-4
- Tailwind v3.4 (not v4)
- Package manager: pnpm
- Stay local-only through Phase 4, fix Vercel in Phase 5
- Supabase key env var names: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (anon) + SUPABASE_SECRET_KEY (service role)
- SHARP_META recommendation_type: "play" | "no_play" (not "parlay"/"monitor" from original spec)
- estimated_payout: American odds string (e.g. "+285"), not decimal multiplier
- legs: min 1, max 3 (single-leg best bets valid; 4+ legs never pass validation)

## Lessons learned:
- Route groups (parens) strip from URL. External redirect URLs must match actual filesystem path outside groups.
- Supabase SQL editor shows "Success" on silent transaction abort. Always wrap DDL migrations in BEGIN/COMMIT with sentinel SELECTs.
- DROP COLUMN fails if a named CHECK constraint references the column. Drop the constraint first.
- PostgREST schema cache (PGRST205): send NOTIFY pgrst, 'reload schema'; after adding tables.
- Stale .next cache after dev server restart causes 404 on compiled routes. rm -rf .next to fix.
- Never paste secrets into chat. Give file path + variable name only.
