#!/usr/bin/env node
/**
 * Smoke test for /api/analyze — task 6.
 * Runs two test cases and reports full SSE event sequences, raw meta blocks,
 * parsed Zod output, and DB verification for both paths.
 *
 * Usage:
 *   node scripts/test-analyze.mjs [email]
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// ── Load .env.local ────────────────────────────────────────────────────────────
const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^#=\s][^=]*)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const ANON_KEY = env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
const SERVICE_KEY = env["SUPABASE_SECRET_KEY"];
const BASE_URL = "http://localhost:3000";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

// ── Admin + anon clients ───────────────────────────────────────────────────────
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Find test user and get session ────────────────────────────────────────────
const targetEmail = process.argv[2] ?? null;
const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
if (listErr || !users.length) {
  console.error("Could not list users:", listErr);
  process.exit(1);
}

const testUser = targetEmail
  ? users.find((u) => u.email === targetEmail)
  : users[0];

if (!testUser) {
  console.error(`User not found: ${targetEmail}`);
  process.exit(1);
}

async function getSession() {
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: testUser.email,
    });
  if (linkErr || !linkData) throw new Error(`generateLink: ${linkErr?.message}`);

  const tokenHash = new URL(linkData.properties.action_link).searchParams.get("token");
  if (!tokenHash) throw new Error("No token in action_link");

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (otpErr || !otpData.session)
    throw new Error(`OTP exchange: ${otpErr?.message}`);

  return otpData.session.access_token;
}

// ── DB helpers ─────────────────────────────────────────────────────────────────
async function getProfile(token) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await client
    .from("profiles")
    .select("lifetime_analyses_used")
    .eq("id", testUser.id)
    .single();
  return data?.lifetime_analyses_used ?? "?";
}

async function getLastAnalysis(token) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await client
    .from("analyses")
    .select("id, sport, created_at")
    .eq("user_id", testUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function getParlay(token, analysisId) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await client
    .from("parlays")
    .select("id, confidence, legs, kill_conditions, estimated_payout, outcome")
    .eq("analysis_id", analysisId)
    .maybeSingle();
  return data;
}

// ── SSE runner ─────────────────────────────────────────────────────────────────
async function runTest(label, token, body) {
  const divider = "═".repeat(70);
  console.log(`\n${divider}`);
  console.log(`TEST ${label}`);
  console.log(divider);

  const countBefore = await getProfile(token);
  console.log(`\nlifetime_analyses_used BEFORE: ${countBefore}`);

  const startMs = Date.now();
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  // Non-SSE error
  if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
    const err = await res.json();
    console.error(`\nHTTP ${res.status}:`, JSON.stringify(err, null, 2));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = null;
  const eventLog = []; // { t, event, data }

  let rawMeta = null;         // the raw ---SHARP_META---...---END_SHARP_META--- block
  let proseLines = [];
  let captureMode = "prose";  // "prose" | "meta_open" | "meta_body" | "meta_close"
  let metaAccum = "";

  console.log("\n── PROSE ──────────────────────────────────────────────────────");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
        eventLog.push({ t: Date.now() - startMs, event: currentEvent, data: null });
      } else if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }

        // Update last event entry with data
        if (eventLog.length && eventLog[eventLog.length - 1].data === null) {
          eventLog[eventLog.length - 1].data = parsed;
        } else {
          eventLog.push({ t: Date.now() - startMs, event: currentEvent ?? "message", data: parsed });
        }

        if (!currentEvent && typeof parsed === "object" && parsed.token !== undefined) {
          process.stdout.write(parsed.token);
          proseLines.push(parsed.token);
        }
        currentEvent = null;
      }
    }
  }

  // Extract raw SHARP_META block from the complete event payload
  const completeEvent = eventLog.find((e) => e.event === "complete");
  const parsedMeta = completeEvent?.data?.meta ?? null;

  console.log("\n\n── SSE EVENT SEQUENCE ─────────────────────────────────────────");
  for (const e of eventLog) {
    if (e.event === "message" && e.data?.token !== undefined) continue; // skip prose tokens
    const tag = e.event ? `[${e.event}]` : "[message]";
    const summary =
      e.event === "complete"
        ? `analysis_id=${e.data?.analysis_id} parlay_id=${e.data?.parlay_id}`
        : e.event === "parse_failed"
        ? `reason=${e.data?.reason}`
        : e.event === "error"
        ? `code=${e.data?.code}`
        : JSON.stringify(e.data)?.slice(0, 60);
    console.log(`  +${String(e.t).padStart(5)}ms  ${tag}  ${summary}`);
  }

  console.log("\n── PARSED META (Zod output) ───────────────────────────────────");
  if (parsedMeta) {
    console.log(JSON.stringify(parsedMeta, null, 2));
  } else {
    const failEvent = eventLog.find((e) => e.event === "parse_failed" || e.event === "error");
    console.log(failEvent ? JSON.stringify(failEvent.data, null, 2) : "(none — no complete event)");
  }

  // DB verification
  const countAfter = await getProfile(token);
  console.log(`\n── DB VERIFICATION ────────────────────────────────────────────`);
  console.log(`lifetime_analyses_used BEFORE: ${countBefore} → AFTER: ${countAfter}`);
  console.log(`Counter incremented: ${countAfter > countBefore ? "YES ✓" : "NO ✗"}`);

  if (completeEvent?.data?.analysis_id) {
    const analysis = await getLastAnalysis(token);
    console.log(`\nanalyses row: ${JSON.stringify(analysis, null, 2)}`);

    const parlay = await getParlay(token, completeEvent.data.analysis_id);
    if (parlay) {
      console.log(`\nparlays row:`);
      console.log(JSON.stringify(parlay, null, 2));
    } else {
      console.log(`\nparlays row: (none — expected for NO PLAY)`);
    }
  } else {
    console.log("(no analysis_id in complete event — DB write may have failed)");
  }
}

// ── Test cases ─────────────────────────────────────────────────────────────────
console.log(`User: ${testUser.email}`);

// Each test needs a fresh session (magic links are single-use)
const tokenA = await getSession();
const tokenB = await getSession();

// Test A — engineered for NO PLAY
// Q1 with no injuries, all lines overpriced (-130 to -140), too early for pace props
await runTest("A — expected: NO PLAY", tokenA, {
  sport: "nba",
  game_context:
    "NBA, Lakers vs Warriors, 4:32 left in Q1, score tied 22-22. " +
    "LeBron 6 pts on 2-4 FG. Curry 8 pts on 3-7. " +
    "No injuries, no foul trouble, full lineups.",
  user_question:
    "What's the play? Available lines: LeBron points o24.5 at -135 DraftKings, " +
    "Curry points o27.5 at -140 DraftKings, game total o228 at -130 DraftKings.",
});

// Test B — engineered for PLAY
// Q3, known defender (Herro) is out, Bam rebounding against depleted Heat,
// Bam line -115 (at the juice threshold), BOS team total -110 (clean)
await runTest("B — expected: PLAY", tokenB, {
  sport: "nba",
  game_context:
    "NBA, Celtics vs Heat, 6:48 left in Q3, BOS leads 78-71. " +
    "Jayson Tatum: 22 pts on 9-14 FG, 4 fouls. " +
    "Bam Adebayo: 18 pts, 11 reb. " +
    "Tyler Herro out (ankle) — did not return from locker room at start of Q3. " +
    "Heat playing shorthanded, Bam logging heavy minutes at center.",
  user_question:
    "What's the play? Available lines: Bam rebounds o12.5 at -115 DraftKings, " +
    "BOS team total o108.5 at -110 DraftKings, Tatum points o31.5 at -120 FanDuel.",
});

console.log("\n" + "═".repeat(70));
console.log("Smoke test complete.");
