import { NextRequest, NextResponse } from "next/server";
import { authorizeCouple, supabaseHeaders } from "../../../lib/couple";

type RandomKind = "date" | "drink" | "food";
type RandomBody =
  | { action?: "item"; kind?: "drink" | "food"; name?: string; emoji?: string; weight?: number }
  | { action?: "share"; kind?: RandomKind; title?: string; detail?: string; picked_by?: string };

export async function GET(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const itemQuery = new URLSearchParams({ couple_code: `eq.${auth.coupleCode}`, order: "created_at.asc" });
  const resultQuery = new URLSearchParams({ couple_code: `eq.${auth.coupleCode}`, order: "created_at.desc", limit: "12" });
  const [itemsResponse, resultsResponse] = await Promise.all([
    fetch(`${auth.cfg.url}/rest/v1/random_items?${itemQuery.toString()}`, { headers: supabaseHeaders(auth.cfg.key), cache: "no-store" }),
    fetch(`${auth.cfg.url}/rest/v1/random_results?${resultQuery.toString()}`, { headers: supabaseHeaders(auth.cfg.key), cache: "no-store" }),
  ]);
  const items = await itemsResponse.json();
  const results = await resultsResponse.json();
  if (!itemsResponse.ok) return NextResponse.json(items, { status: itemsResponse.status });
  if (!resultsResponse.ok) return NextResponse.json(results, { status: resultsResponse.status });
  return NextResponse.json({ items, results });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json()) as RandomBody;

  if (body.action === "item") {
    if (body.kind !== "drink" && body.kind !== "food") return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
    const payload = {
      couple_code: auth.coupleCode,
      kind: body.kind,
      name: name.slice(0, 80),
      emoji: (body.emoji?.trim() || (body.kind === "drink" ? "🥂" : "😋")).slice(0, 12),
      weight: Math.min(100, Math.max(1, Number(body.weight) || (body.kind === "drink" ? 10 : 1))),
    };
    const response = await fetch(`${auth.cfg.url}/rest/v1/random_items`, {
      method: "POST",
      headers: supabaseHeaders(auth.cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  if (body.action === "share") {
    if (body.kind !== "date" && body.kind !== "drink" && body.kind !== "food") return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
    const pickedBy = String(body.picked_by || "함께").trim().slice(0, 80) || "함께";
    const payload = {
      couple_code: auth.coupleCode,
      kind: body.kind,
      title: title.slice(0, 120),
      detail: body.detail?.trim().slice(0, 240) || "",
      picked_by: pickedBy,
    };
    const response = await fetch(`${auth.cfg.url}/rest/v1/random_results`, {
      method: "POST",
      headers: supabaseHeaders(auth.cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const itemId = new URL(request.url).searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "item_id_required" }, { status: 400 });
  const query = new URLSearchParams({ id: `eq.${itemId}`, couple_code: `eq.${auth.coupleCode}` });
  const response = await fetch(`${auth.cfg.url}/rest/v1/random_items?${query.toString()}`, {
    method: "DELETE",
    headers: supabaseHeaders(auth.cfg.key, { Prefer: "return=representation" }),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
