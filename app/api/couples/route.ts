import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authorizeCouple,
  env,
  hashPin,
  normalizeCode,
  supabaseHeaders,
  validatePin,
  verifyPin,
} from "../../../lib/couple";

function cleanName(value: unknown) {
  return String(value || "").trim().slice(0, 40);
}

function randomCode() {
  return crypto.randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}


async function migrateLegacyTables(url: string, key: string, oldCode: string, newCode: string) {
  if (!oldCode || oldCode === newCode) return;
  const query = new URLSearchParams({ couple_code: `eq.${oldCode}` });
  await Promise.all(["date_ideas", "random_items", "random_results"].map((table) =>
    fetch(`${url}/rest/v1/${table}?${query.toString()}`, {
      method: "PATCH",
      headers: supabaseHeaders(key),
      body: JSON.stringify({ couple_code: newCode }),
    }).catch(() => null),
  ));
}

async function codeExists(url: string, key: string, code: string) {
  const query = new URLSearchParams({ couple_code: `eq.${code}`, select: "couple_code", limit: "1" });
  const response = await fetch(`${url}/rest/v1/couples?${query.toString()}`, {
    headers: supabaseHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) return true;
  const rows = (await response.json()) as Array<{ couple_code: string }>;
  return rows.length > 0;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(auth.profile);
}

export async function POST(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "create");

  if (action === "claim-legacy") {
    const pin = String(body.pin || "").trim();
    if (!cfg.legacyCode || !cfg.legacyPin || !pin || pin !== cfg.legacyPin) {
      return NextResponse.json({ error: "legacy_not_available" }, { status: 401 });
    }
    const code = normalizeCode(cfg.legacyCode);
    const query = new URLSearchParams({ couple_code: `eq.${code}`, select: "couple_code,name1,name2,budget_url,pin_hash", limit: "1" });
    const found = await fetch(`${cfg.url}/rest/v1/couples?${query.toString()}`, {
      headers: supabaseHeaders(cfg.key),
      cache: "no-store",
    });
    if (found.ok) {
      const rows = (await found.json()) as Array<{ couple_code: string; name1: string; name2: string; budget_url?: string; pin_hash: string }>;
      if (rows[0]) {
        if (!verifyPin(pin, rows[0].pin_hash)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });
        await migrateLegacyTables(cfg.url, cfg.key, cfg.legacyCode, code);
        return NextResponse.json({ couple_code: rows[0].couple_code, name1: rows[0].name1, name2: rows[0].name2, budget_url: rows[0].budget_url || "" });
      }
    }
    const create = await fetch(`${cfg.url}/rest/v1/couples`, {
      method: "POST",
      headers: supabaseHeaders(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify({ couple_code: code, name1: "태환", name2: "선영", pin_hash: hashPin(pin), budget_url: process.env.NEXT_PUBLIC_BUDGET_APP_URL || "" }),
    });
    const rows = await create.json();
    if (create.ok) await migrateLegacyTables(cfg.url, cfg.key, cfg.legacyCode, code);
    return NextResponse.json(Array.isArray(rows) ? rows[0] : rows, { status: create.status });
  }

  const name1 = cleanName(body.name1);
  const name2 = cleanName(body.name2);
  const pin = String(body.pin || "").trim();
  if (!name1 || !name2) return NextResponse.json({ error: "names_required" }, { status: 400 });
  if (!validatePin(pin)) return NextResponse.json({ error: "pin_length" }, { status: 400 });

  let coupleCode = "";
  for (let i = 0; i < 8; i += 1) {
    const candidate = randomCode();
    if (candidate.length >= 6 && !(await codeExists(cfg.url, cfg.key, candidate))) {
      coupleCode = candidate;
      break;
    }
  }
  if (!coupleCode) return NextResponse.json({ error: "code_generation_failed" }, { status: 500 });

  const response = await fetch(`${cfg.url}/rest/v1/couples`, {
    method: "POST",
    headers: supabaseHeaders(cfg.key, { Prefer: "return=representation" }),
    body: JSON.stringify({ couple_code: coupleCode, name1, name2, pin_hash: hashPin(pin) }),
  });
  const rows = await response.json();
  if (!response.ok) return NextResponse.json(rows, { status: response.status });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return NextResponse.json({ couple_code: row.couple_code, name1: row.name1, name2: row.name2, budget_url: row.budget_url || "" }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name1 = cleanName(body.name1) || auth.profile.name1;
  const name2 = cleanName(body.name2) || auth.profile.name2;
  const newPin = String(body.newPin || "").trim();
  const budgetUrl = String(body.budgetUrl ?? auth.profile.budget_url ?? "").trim().slice(0, 500);
  if (newPin && !validatePin(newPin)) return NextResponse.json({ error: "pin_length" }, { status: 400 });

  const payload: Record<string, unknown> = { name1, name2, budget_url: budgetUrl, updated_at: new Date().toISOString() };
  if (newPin) payload.pin_hash = hashPin(newPin);

  const query = new URLSearchParams({ couple_code: `eq.${auth.coupleCode}` });
  const response = await fetch(`${auth.cfg.url}/rest/v1/couples?${query.toString()}`, {
    method: "PATCH",
    headers: supabaseHeaders(auth.cfg.key, { Prefer: "return=representation" }),
    body: JSON.stringify(payload),
  });
  const rows = await response.json();
  if (!response.ok) return NextResponse.json(rows, { status: response.status });

  const renameTasks: Promise<Response>[] = [];
  if (auth.profile.name1 !== name1) {
    const dateQuery = new URLSearchParams({ couple_code: `eq.${auth.coupleCode}`, created_by: `eq.${auth.profile.name1}` });
    const resultQuery = new URLSearchParams({ couple_code: `eq.${auth.coupleCode}`, picked_by: `eq.${auth.profile.name1}` });
    renameTasks.push(fetch(`${auth.cfg.url}/rest/v1/date_ideas?${dateQuery.toString()}`, { method: "PATCH", headers: supabaseHeaders(auth.cfg.key), body: JSON.stringify({ created_by: name1 }) }));
    renameTasks.push(fetch(`${auth.cfg.url}/rest/v1/random_results?${resultQuery.toString()}`, { method: "PATCH", headers: supabaseHeaders(auth.cfg.key), body: JSON.stringify({ picked_by: name1 }) }));
  }
  if (auth.profile.name2 !== name2) {
    const dateQuery = new URLSearchParams({ couple_code: `eq.${auth.coupleCode}`, created_by: `eq.${auth.profile.name2}` });
    const resultQuery = new URLSearchParams({ couple_code: `eq.${auth.coupleCode}`, picked_by: `eq.${auth.profile.name2}` });
    renameTasks.push(fetch(`${auth.cfg.url}/rest/v1/date_ideas?${dateQuery.toString()}`, { method: "PATCH", headers: supabaseHeaders(auth.cfg.key), body: JSON.stringify({ created_by: name2 }) }));
    renameTasks.push(fetch(`${auth.cfg.url}/rest/v1/random_results?${resultQuery.toString()}`, { method: "PATCH", headers: supabaseHeaders(auth.cfg.key), body: JSON.stringify({ picked_by: name2 }) }));
  }
  if (renameTasks.length) await Promise.allSettled(renameTasks);

  const row = Array.isArray(rows) ? rows[0] : rows;
  return NextResponse.json({ couple_code: row.couple_code, name1: row.name1, name2: row.name2, budget_url: row.budget_url || "" });
}
