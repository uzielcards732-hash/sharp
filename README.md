# Sharp

A mobile-first PWA delivering AI-powered live sports parlay analysis. Subscribers enter tonight's matchup; Sharp pulls live box scores and current props/odds, runs them through a locked discipline-enforcement system prompt on Claude Sonnet 4.6, and streams back a structured 2-leg parlay with confidence rating, kill conditions, and explicit "NO PLAY" calls when the slate is dead. The product's value isn't generating parlays — it's refusing the bad ones.

## Tech stack

- Next.js 15 (App Router) · TypeScript strict
- Tailwind CSS v3.4 · shadcn/ui · dark mode default
- Supabase (Auth + Postgres, `@supabase/ssr`, magic link)
- Anthropic SDK (`claude-sonnet-4-6`, streaming SSE)
- The Odds API · BallDontLie (NBA)
- Stripe Checkout + Customer Portal
- Vercel · PWA (manifest + service worker)

See [DECISIONS.md](./DECISIONS.md) for locked product/architecture decisions.

## Run locally

```bash
pnpm install
cp .env.local.example .env.local   # fill in keys
pnpm dev
```

## Phase Status

- [ ] **Phase 1** — Skeleton: Next 15 + Tailwind v3.4 + shadcn, env scaffold, Vercel deploy
- [ ] **Phase 2** — Auth + DB: Supabase setup, schema migration, magic-link login, protected routes
- [ ] **Phase 3** — Core analysis loop: `/api/analyze` with mock data, Claude streaming, parlay card
- [ ] **Phase 4** — Real data: BallDontLie + Odds API wired with caching
- [ ] **Phase 5** — Monetization: Stripe Checkout + webhook + paywall + affiliate redirects
- [ ] **Phase 6** — PWA polish: manifest, service worker, install prompt, iOS icons
