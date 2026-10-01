import crypto from "node:crypto";
import { NextRequest } from "next/server";

export type CoupleProfile = {
  couple_code: string;
  name1: string;
  name2: string;
  budget_url?: string;
  created_at?: string;
  updated_at?: string;
};

type CoupleRecord = CoupleProfile & { pin_hash: string };

export function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/$/, ""),
    key,
    legacyCode: process.env.COUPLE_CODE?.trim() || "",
    legacyPin: process.env.COUPLE_PIN?.trim() || "",
  };
}

export function supabaseHeaders(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
}

export function validatePin(value: string) {
  return value.trim().length >= 4 && value.trim().length <= 20;
}

export function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(pin, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

async function getCoupleByCode(code: string) {
  const cfg = env();
  if (!cfg) return { cfg: null, couple: null as CoupleRecord | null, responseStatus: 503 };
  const query = new URLSearchParams({
    couple_code: `eq.${code}`,
    select: "couple_code,name1,name2,budget_url,pin_hash,created_at,updated_at",
    limit: "1",
  });
  const response = await fetch(`${cfg.url}/rest/v1/couples?${query.toString()}`, {
    headers: supabaseHeaders(cfg.key),
    cache: "no-store",
  });
  if (!response.ok) return { cfg, couple: null as CoupleRecord | null, responseStatus: response.status };
  const rows = (await response.json()) as CoupleRecord[];
  return { cfg, couple: rows[0] || null, responseStatus: response.status };
}

async function migrateLegacyData(url: string, key: string, oldCode: string, newCode: string) {
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

async function insertLegacyCouple(code: string, pin: string) {
  const cfg = env();
  if (!cfg) return null;
  const payload = {
    couple_code: code,
    name1: "태환",
    name2: "선영",
    pin_hash: hashPin(pin),
    budget_url: process.env.NEXT_PUBLIC_BUDGET_APP_URL || "",
  };
  const response = await fetch(`${cfg.url}/rest/v1/couples`, {
    method: "POST",
    headers: supabaseHeaders(cfg.key, { Prefer: "return=representation,resolution=merge-duplicates" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  await migrateLegacyData(cfg.url, cfg.key, cfg.legacyCode, code);
  const rows = (await response.json()) as CoupleRecord[];
  return rows[0] || payload;
}

export async function authorizeCouple(request: NextRequest) {
  const cfg = env();
  if (!cfg) return { ok: false as const, status: 503, error: "cloud_not_configured" };

  const code = normalizeCode(request.headers.get("x-couple-code") || "");
  const pin = (request.headers.get("x-couple-pin") || "").trim();
  if (!code || !pin) return { ok: false as const, status: 401, error: "couple_login_required" };

  const lookup = await getCoupleByCode(code);
  if (lookup.responseStatus >= 400 && lookup.responseStatus !== 404) {
    return { ok: false as const, status: lookup.responseStatus, error: "couple_lookup_failed" };
  }

  let couple = lookup.couple;
  if (!couple && cfg.legacyCode && cfg.legacyPin && normalizeCode(cfg.legacyCode) === code && cfg.legacyPin === pin) {
    couple = (await insertLegacyCouple(code, pin)) as CoupleRecord | null;
  }

  if (!couple || !verifyPin(pin, couple.pin_hash)) {
    return { ok: false as const, status: 401, error: "wrong_pin_or_code" };
  }

  return {
    ok: true as const,
    cfg,
    coupleCode: couple.couple_code,
    profile: {
      couple_code: couple.couple_code,
      name1: couple.name1,
      name2: couple.name2,
      budget_url: couple.budget_url || "",
      created_at: couple.created_at,
      updated_at: couple.updated_at,
    } satisfies CoupleProfile,
  };
}
