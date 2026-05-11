"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ParlayCard, type CardState } from "@/components/parlay-card";

const FREE_LIMIT = 3;

const SPORTS = [
  { id: "nba", label: "NBA", enabled: true },
  { id: "mlb", label: "MLB", enabled: false },
  { id: "nfl", label: "NFL", enabled: false },
] as const;

interface AnalyzeFormProps {
  initialAnalysesUsed: number;
}

export function AnalyzeForm({ initialAnalysesUsed }: AnalyzeFormProps) {
  const [sport, setSport] = useState<"nba" | "mlb" | "nfl">("nba");
  const [gameContext, setGameContext] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [analysesUsed, setAnalysesUsed] = useState(initialAnalysesUsed);
  const [isLoading, setIsLoading] = useState(false);
  const [cardState, setCardState] = useState<CardState>({ status: "idle" });
  const [hasStreamed, setHasStreamed] = useState(false);

  // Ref-based prose: direct DOM mutation during stream, zero re-renders per token
  const proseRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const limitReached = analysesUsed >= FREE_LIMIT;

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (isLoading || limitReached) return;

    // Reset
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    if (proseRef.current) proseRef.current.textContent = "";
    setCardState({ status: "streaming" });
    setHasStreamed(true);
    setIsLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport,
          game_context: gameContext,
          user_question: userQuestion,
        }),
        signal: abortRef.current.signal,
      });

      // Pre-stream errors (402, 401, 400)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ code: "unknown_error" }));
        if (body.code === "limit_exceeded") {
          setAnalysesUsed(FREE_LIMIT);
          setCardState({ status: "idle" });
        } else {
          setCardState({ status: "error", code: body.code ?? "unknown_error" });
        }
        setIsLoading(false);
        return;
      }

      // Stream SSE events
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(5).trim());
            } catch {
              currentEvent = null;
              continue;
            }

            if (!currentEvent && typeof data.token === "string") {
              // Prose token — direct DOM write, no re-render
              if (proseRef.current) proseRef.current.textContent += data.token;
            } else if (currentEvent === "complete") {
              setCardState({
                status: "complete",
                meta: data.meta as never,
                parlayId: (data.parlay_id as string | null) ?? null,
              });
              setAnalysesUsed((n) => n + 1);
              setIsLoading(false);
            } else if (currentEvent === "parse_failed") {
              setCardState({ status: "parse_failed" });
              setIsLoading(false);
            } else if (currentEvent === "error") {
              setCardState({ status: "error", code: data.code as string });
              setIsLoading(false);
            }
            currentEvent = null;
          } else if (line === "") {
            currentEvent = null;
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        if (proseRef.current && proseRef.current.textContent.length > 0) {
          // Had partial prose — treat as network drop
          setCardState({ status: "error", code: "network_drop" });
        } else {
          setCardState({ status: "error", code: "network_error" });
        }
      }
      setIsLoading(false);
    }
  }

  function handleRetry() {
    handleSubmit();
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ── Form panel ─────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[40%] shrink-0">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sport
            </label>
            <div className="flex gap-2">
              {SPORTS.map(({ id, label, enabled }) => (
                <div key={id} className="relative">
                  <button
                    type="button"
                    disabled={!enabled || isLoading}
                    onClick={() => enabled && setSport(id as "nba")}
                    className={[
                      "rounded-md border px-4 py-1.5 text-sm font-medium transition-colors",
                      enabled && sport === id
                        ? "border-accent bg-accent/10 text-accent"
                        : enabled
                        ? "border-border bg-transparent text-muted-foreground hover:border-accent/50 hover:text-foreground"
                        : "cursor-not-allowed border-border bg-transparent text-muted-foreground/40",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                  {!enabled && (
                    <span className="absolute -right-1 -top-2 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                      Soon
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Game context */}
          <div className="space-y-2">
            <label
              htmlFor="game-context"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Game context
            </label>
            <textarea
              id="game-context"
              rows={6}
              placeholder="Score, quarter/time, key stats, foul trouble, injuries, lineup changes..."
              value={gameContext}
              onChange={(e) => setGameContext(e.target.value)}
              disabled={isLoading || limitReached}
              required
              minLength={10}
              maxLength={2000}
              className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* User question */}
          <div className="space-y-2">
            <label
              htmlFor="user-question"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Question
            </label>
            <textarea
              id="user-question"
              rows={3}
              placeholder="What line are you looking at? What's your read?"
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              disabled={isLoading || limitReached}
              required
              minLength={5}
              maxLength={500}
              className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Usage counter */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <span className={analysesUsed >= FREE_LIMIT ? "text-destructive font-semibold" : "font-medium text-foreground"}>
                {analysesUsed}
              </span>
              {" "}of {FREE_LIMIT} free analyses used
            </span>
            <span className="flex gap-1">
              {Array.from({ length: FREE_LIMIT }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-5 rounded-full ${i < analysesUsed ? "bg-accent" : "bg-border"}`}
                />
              ))}
            </span>
          </div>

          {/* Submit or upgrade CTA */}
          {limitReached ? (
            <div className="space-y-2">
              <Button type="button" className="w-full" disabled>
                Limit reached
              </Button>
              <button
                type="button"
                className="w-full rounded-md border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                Upgrade to Pro — unlimited analyses
              </button>
            </div>
          ) : (
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Analyzing…" : "Get Sharp read"}
            </Button>
          )}
        </form>
      </div>

      {/* ── Output panel ───────────────────────────────────────────────────── */}
      <div className="w-full lg:flex-1 space-y-4">
        {!hasStreamed && cardState.status === "idle" ? (
          <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              Submit a game context to get a Sharp read.
            </p>
          </div>
        ) : (
          <>
            {/* Prose — direct DOM target during stream, persists after */}
            <div
              ref={proseRef}
              className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
            />

            {/* Loading pulse while streaming and prose is empty */}
            {isLoading && (
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
              </div>
            )}

            {/* Structured card — appears after stream completes */}
            <ParlayCard state={cardState} onRetry={handleRetry} />
          </>
        )}
      </div>
    </div>
  );
}
