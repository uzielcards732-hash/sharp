import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SHARP_SYSTEM_PROMPT } from "@/lib/prompts/sharp-v1";
import { SharpMetaSchema } from "@/lib/schemas/sharp-meta";

export const runtime = "nodejs";
export const maxDuration = 60;

const META_OPEN = "---SHARP_META---";
const META_CLOSE = "---END_SHARP_META---";
const FREE_TIER_LIMIT = 3;

const RequestSchema = z.object({
  sport: z.enum(["nba", "nfl", "mlb"]),
  game_context: z.string().min(10).max(2000),
  user_question: z.string().min(5).max(500),
});

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function sse(event: string | null, data: unknown): string {
  const dataLine = `data: ${JSON.stringify(data)}\n\n`;
  return event ? `event: ${event}\n${dataLine}` : dataLine;
}

export async function POST(request: NextRequest): Promise<Response> {
  // ── 1. Parse body ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { code: "invalid_input", errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const { sport, game_context, user_question } = parsed.data;

  // ── 2. Auth — cookie (browser) or Bearer token (curl / API) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  let userId: string | null = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    supabase = createSupabaseClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  } else {
    const ssrClient = await createClient();
    supabase = ssrClient;
    const { data } = await ssrClient.auth.getUser();
    userId = data.user?.id ?? null;
  }

  if (!userId) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  // ── 3. Fast-path limit check ───────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("lifetime_analyses_used, subscription_tier")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return Response.json({ code: "profile_not_found" }, { status: 500 });
  }

  const currentCount: number = profile.lifetime_analyses_used;
  const isFree: boolean = profile.subscription_tier === "free";

  if (isFree && currentCount >= FREE_TIER_LIMIT) {
    return Response.json(
      { code: "limit_exceeded", limit: FREE_TIER_LIMIT, used: currentCount },
      { status: 402 }
    );
  }

  // ── 4. SSE stream ──────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string | null, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      let fullText = "";
      let emittedUpTo = 0;
      let metaFound = false;

      // ── 4a. Anthropic stream ─────────────────────────────────
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SHARP_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Sport: ${sport}\n\nGame context:\n${game_context}\n\nQuestion:\n${user_question}`,
            },
          ],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;

            if (!metaFound) {
              const metaIdx = fullText.indexOf(META_OPEN);
              if (metaIdx !== -1) {
                // Flush remaining prose up to the marker
                metaFound = true;
                const pending = fullText.slice(emittedUpTo, metaIdx);
                if (pending) emit(null, { token: pending });
                emittedUpTo = metaIdx;
              } else {
                // Hold back META_OPEN.length chars to avoid splitting the marker
                const safeEnd = Math.max(
                  emittedUpTo,
                  fullText.length - META_OPEN.length
                );
                if (safeEnd > emittedUpTo) {
                  emit(null, { token: fullText.slice(emittedUpTo, safeEnd) });
                  emittedUpTo = safeEnd;
                }
              }
            }
          }
        }
      } catch (err) {
        const isOverloaded =
          err instanceof Anthropic.APIError && err.status === 529;
        const isContentBlocked =
          err instanceof Anthropic.APIError && err.status === 400;
        emit("error", {
          code: isOverloaded
            ? "provider_overloaded"
            : isContentBlocked
            ? "content_blocked"
            : "provider_error",
        });
        controller.close();
        return;
      }

      // ── 4b. Parse meta block ─────────────────────────────────
      const metaStart = fullText.indexOf(META_OPEN);
      const metaEnd = fullText.indexOf(META_CLOSE);

      if (metaStart === -1 || metaEnd === -1 || metaEnd <= metaStart) {
        emit("parse_failed", { reason: "meta_block_missing" });
        controller.close();
        return;
      }

      const jsonStr = fullText
        .slice(metaStart + META_OPEN.length, metaEnd)
        .trim();

      let rawMeta: unknown;
      try {
        rawMeta = JSON.parse(jsonStr);
      } catch {
        emit("parse_failed", { reason: "meta_json_invalid" });
        controller.close();
        return;
      }

      const metaResult = SharpMetaSchema.safeParse(rawMeta);
      if (!metaResult.success) {
        emit("parse_failed", {
          reason: "meta_schema_invalid",
          issues: metaResult.error.issues,
        });
        controller.close();
        return;
      }

      const meta = metaResult.data;
      const proseText = fullText.slice(0, metaStart).trim();

      // ── 4c. DB writes (analyses row is write-once) ───────────
      const { data: analysisRow, error: analysisError } = await supabase
        .from("analyses")
        .insert({
          user_id: userId,
          sport,
          game_context,
          user_question,
          full_response_text: fullText,
        })
        .select("id")
        .single();

      if (analysisError || !analysisRow) {
        console.error("[sharp] analyses insert failed:", analysisError);
        emit("error", { code: "db_write_failed" });
        controller.close();
        return;
      }

      let parlayId: string | null = null;
      if (meta.recommendation_type === "play") {
        const { data: parlayRow, error: parlayError } = await supabase
          .from("parlays")
          .insert({
            user_id: userId,
            analysis_id: analysisRow.id,
            confidence: meta.confidence,
            legs: meta.legs,
            kill_conditions: meta.kill_conditions,
            estimated_payout: meta.estimated_payout,
            outcome: "pending",
          })
          .select("id")
          .single();

        if (parlayError) {
          // Analysis saved; log the parlay failure but don't surface it
          console.error("[sharp] parlays insert failed:", parlayError);
        } else {
          parlayId = parlayRow?.id ?? null;
        }
      }

      // ── 4d. Atomic increment (concurrent safety gate) ────────
      if (isFree) {
        const { data: incremented } = await supabase
          .from("profiles")
          .update({ lifetime_analyses_used: currentCount + 1 })
          .eq("id", userId)
          .eq("lifetime_analyses_used", currentCount) // optimistic lock
          .select("lifetime_analyses_used");

        if (!incremented || incremented.length === 0) {
          // Race condition: another concurrent request already incremented.
          // Log for Phase 5 monitoring — do not surface to the user.
          console.warn("[sharp] concurrent submit detected — user:", userId);
        }
      }

      emit("complete", {
        analysis_id: analysisRow.id,
        parlay_id: parlayId,
        meta,
        prose: proseText,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
