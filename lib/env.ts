import { z } from "zod";

/**
 * Server-only env. Imported from server components and route handlers.
 * Phase 1 keeps everything optional so the app boots without secrets;
 * later phases will tighten required fields per route that needs them.
 */
const ServerEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase (Phase 2)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  // Anthropic (Phase 3)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Sports data (Phase 4)
  ODDS_API_KEY: z.string().optional(),

  // Stripe (Phase 5)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PRO: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Affiliate URLs (Phase 5)
  AFFILIATE_DRAFTKINGS_URL: z.string().url().optional(),
  AFFILIATE_FANDUEL_URL: z.string().url().optional(),
  AFFILIATE_BETMGM_URL: z.string().url().optional(),
});

export const env = ServerEnv.parse(process.env);
export type Env = z.infer<typeof ServerEnv>;
