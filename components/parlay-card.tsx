"use client";

import { Button } from "@/components/ui/button";
import type { SharpMeta, Leg } from "@/lib/schemas/sharp-meta";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CardState =
  | { status: "idle" }
  | { status: "streaming" }
  | { status: "complete"; meta: SharpMeta; parlayId: string | null }
  | { status: "parse_failed" }
  | { status: "error"; code: string };

interface ParlayCardProps {
  state: CardState;
  onRetry: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MARKET_LABELS: Record<string, string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  threes: "3-Pointers",
  steals: "Steals",
  blocks: "Blocks",
  pra: "Pts + Reb + Ast",
  pts_rebs: "Pts + Rebounds",
  pts_asts: "Pts + Assists",
  double_double: "Double-Double",
  triple_double: "Triple-Double",
  spread: "Spread",
  total: "Total",
  moneyline: "Moneyline",
};

const PLAYER_MARKETS = new Set([
  "points", "rebounds", "assists", "threes", "steals", "blocks",
  "pra", "pts_rebs", "pts_asts", "double_double", "triple_double",
]);

function formatLegLine(leg: Leg): string {
  const label = MARKET_LABELS[leg.market] ?? leg.market;
  if (PLAYER_MARKETS.has(leg.market)) {
    return `${label} Over ${leg.line}`;
  }
  return `${label} ${leg.line > 0 ? "+" : ""}${leg.line}`;
}

function confidenceStyles(confidence: number): { badge: string; label: string } {
  if (confidence >= 8) return { badge: "bg-accent/15 text-accent border border-accent/30", label: "HIGH" };
  if (confidence >= 5) return { badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30", label: "MED" };
  return { badge: "bg-muted text-muted-foreground border border-border", label: "LOW" };
}

function errorMessage(code: string): string {
  if (code === "provider_overloaded") return "Sharp is overloaded — try again in 30 seconds.";
  if (code === "content_blocked") return "Request blocked by content policy.";
  return "An unexpected error occurred.";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const { badge, label } = confidenceStyles(confidence);
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
        {label} · {confidence}/10
      </span>
    </div>
  );
}

function LegRow({ leg }: { leg: Leg }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{leg.player}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatLegLine(leg)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-accent">{leg.price}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{leg.book}</p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ParlayCard({ state, onRetry }: ParlayCardProps) {
  if (state.status === "idle" || state.status === "streaming") return null;

  // ── parse_failed ────────────────────────────────────────────────────────────
  if (state.status === "parse_failed") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-medium text-amber-400">
          Structured parlay unavailable — this analysis did not count against your limit.
        </p>
      </div>
    );
  }

  // ── error ───────────────────────────────────────────────────────────────────
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
        <p className="mb-3 text-sm text-destructive-foreground">{errorMessage(state.code)}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  // ── complete ─────────────────────────────────────────────────────────────────
  const { meta } = state;

  // NO PLAY
  if (meta.recommendation_type === "no_play") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-destructive">NO PLAY</span>
          <ConfidenceBadge confidence={meta.confidence} />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{meta.reasoning}</p>
      </div>
    );
  }

  // PLAY
  return (
    <div className="rounded-xl border border-accent/30 bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-widest text-accent">Sharp Play</span>
        <ConfidenceBadge confidence={meta.confidence} />
      </div>

      {/* Legs */}
      <div className="space-y-2">
        {meta.legs.map((leg, i) => (
          <LegRow key={i} leg={leg} />
        ))}
      </div>

      {/* Payout */}
      <div className="flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Est. Payout</span>
        <span className="text-2xl font-bold tabular-nums text-foreground">{meta.estimated_payout}</span>
      </div>

      {/* Kill conditions */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Kill conditions
        </p>
        <ul className="space-y-1">
          {meta.kill_conditions.map((kc, i) => (
            <li key={i} className="flex gap-2 text-xs text-muted-foreground">
              <span className="mt-0.5 shrink-0 text-destructive">✕</span>
              <span>{kc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
