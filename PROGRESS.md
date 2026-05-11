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

## Decisions made:
- Free tier: 3 lifetime analyses
- Auth: magic link only
- NBA only for Phase 3-4
- Tailwind v3.4 (not v4)
- Package manager: pnpm
- Stay local-only through Phase 4, fix Vercel in Phase 5
- Supabase key env var names: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (anon) + SUPABASE_SECRET_KEY (service role)
