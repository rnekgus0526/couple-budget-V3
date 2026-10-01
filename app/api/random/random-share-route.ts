import { NextRequest, NextResponse } from "next/server";

type Person = "태환" | "선영" | "함께";
type RandomKind = "date" | "drink" | "food";

type RandomBody =
  | {
      action?: "item";
      kind?: "drink" | "food";
      name?: string;
      emoji?: string;
      weight?: number;
    }
  | {
      action?: "share";
      kind?: RandomKind;
      title?: string;
      detail?: string;
      picked_by?: Person;
    };

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const coupleCode = process.env.COUPLE_CODE;
  if (!url || !key || !coupleCode) return null;
  return { url: url.replace(/\/$/, ""), key, coupleCode };
}

function authorized(request: NextRequest) {
  const required = process.env.COUPLE_PIN;
  if (!required) return true;
  return request.headers.get("x-couple-pin") === required;
}

function headers(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function GET(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });

  const itemQuery = new URLSearchParams({
    couple_code: `eq.${cfg.coupleCode}`,
    order: "created_at.asc",
  });
  const resultQuery = new URLSearchParams({
    couple_code: `eq.${cfg.coupleCode}`,
    order: "created_at.desc",
    limit: "12",
  });

  const [itemsResponse, resultsResponse] = await Promise.all([
    fetch(`${cfg.url}/rest/v1/random_items?${itemQuery.toString()}`, {
      headers: headers(cfg.key),
      cache: "no-store",
    }),
    fetch(`${cfg.url}/rest/v1/random_results?${resultQuery.toString()}`, {
      headers: headers(cfg.key),
      cache: "no-store",
    }),
  ]);

  const items = await itemsResponse.json();
  const results = await resultsResponse.json();
  if (!itemsResponse.ok) return NextResponse.json(items, { status: itemsResponse.status });
  if (!resultsResponse.ok) return NextResponse.json(results, { status: resultsResponse.status });

  return NextResponse.json({ items, results });
}

export async function POST(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });

  const body = (await request.json()) as RandomBody;

  if (body.action === "item") {
    if (body.kind !== "drink" && body.kind !== "food") {
      return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    }
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

    const payload = {
      couple_code: cfg.coupleCode,
      kind: body.kind,
      name: name.slice(0, 80),
      emoji: (body.emoji?.trim() || (body.kind === "drink" ? "🥂" : "😋")).slice(0, 12),
      weight: Math.min(100, Math.max(1, Number(body.weight) || (body.kind === "drink" ? 10 : 1))),
    };

    const response = await fetch(`${cfg.url}/rest/v1/random_items`, {
      method: "POST",
      headers: headers(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  if (body.action === "share") {
    if (body.kind !== "date" && body.kind !== "drink" && body.kind !== "food") {
      return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    }
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
    const pickedBy: Person = body.picked_by === "태환" || body.picked_by === "선영" || body.picked_by === "함께" ? body.picked_by : "함께";

    const payload = {
      couple_code: cfg.coupleCode,
      kind: body.kind,
      title: title.slice(0, 120),
      detail: body.detail?.trim().slice(0, 240) || "",
      picked_by: pickedBy,
    };

    const response = await fetch(`${cfg.url}/rest/v1/random_results`, {
      method: "POST",
      headers: headers(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });

  const itemId = new URL(request.url).searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "item_id_required" }, { status: 400 });

  const query = new URLSearchParams({ id: `eq.${itemId}`, couple_code: `eq.${cfg.coupleCode}` });
  const response = await fetch(`${cfg.url}/rest/v1/random_items?${query.toString()}`, {
    method: "DELETE",
    headers: headers(cfg.key, { Prefer: "return=representation" }),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
