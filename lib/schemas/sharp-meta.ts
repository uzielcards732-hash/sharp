import { z } from "zod";

const americanOdds = z.string().regex(/^[+-]\d{2,4}$/, {
  message: "Must be American odds format: sign + 2–4 digits (e.g. '-115', '+240')",
});

export const LegSchema = z.object({
  player: z.string().min(1),
  market: z.enum([
    "points",
    "rebounds",
    "assists",
    "threes",
    "steals",
    "blocks",
    "pra",
    "pts_rebs",
    "pts_asts",
    "double_double",
    "triple_double",
    "spread",
    "total",
    "moneyline",
  ]),
  line: z.number(),
  price: americanOdds,
  book: z.string().min(1),
});

export const PlayMetaSchema = z.object({
  recommendation_type: z.literal("play"),
  confidence: z.number().int().min(1).max(10),
  legs: z.array(LegSchema).min(1).max(3),
  kill_conditions: z.array(z.string()).min(2).max(4),
  estimated_payout: americanOdds,
});

export const NoPlayMetaSchema = z.object({
  recommendation_type: z.literal("no_play"),
  confidence: z.number().int().min(1).max(10),
  reasoning: z.string().min(20),
  legs: z.array(LegSchema).length(0).optional(),
  kill_conditions: z.array(z.string()).optional(),
  estimated_payout: americanOdds.optional(),
});

export const SharpMetaSchema = z.discriminatedUnion("recommendation_type", [
  PlayMetaSchema,
  NoPlayMetaSchema,
]);

export type SharpMeta = z.infer<typeof SharpMetaSchema>;
export type PlayMeta = z.infer<typeof PlayMetaSchema>;
export type NoPlayMeta = z.infer<typeof NoPlayMetaSchema>;
export type Leg = z.infer<typeof LegSchema>;
