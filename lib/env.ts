import { z } from "zod";

/**
 * Server-only env. Imported from server components and route handlers.
 */
const ServerEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase (required from Phase 2)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // Anthropic (required from Phase 3)
  ANTHROPIC_API_KEY: z.string().min(1),

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
