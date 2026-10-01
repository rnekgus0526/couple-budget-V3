import { NextRequest, NextResponse } from "next/server";

type DateIdeaPayload = {
  title?: string;
  category?: string;
  place?: string;
  planned_date?: string | null;
  budget?: number | null;
  memo?: string;
  status?: "wishlist" | "planned" | "done";
  favorite?: boolean;
  created_by?: "태환" | "선영" | "함께";
  photo_urls?: string[];
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

  const query = new URLSearchParams({
    couple_code: `eq.${cfg.coupleCode}`,
    order: "created_at.desc",
  });
  const response = await fetch(`${cfg.url}/rest/v1/date_ideas?${query.toString()}`, {
    headers: headers(cfg.key),
    cache: "no-store",
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });

  const body = (await request.json()) as DateIdeaPayload;
  if (!body.title?.trim() || !body.category?.trim()) {
    return NextResponse.json({ error: "title_and_category_required" }, { status: 400 });
  }

  const payload = {
    couple_code: cfg.coupleCode,
    title: body.title.trim(),
    category: body.category,
    place: body.place?.trim() || "",
    planned_date: body.planned_date || null,
    budget: typeof body.budget === "number" ? body.budget : null,
    memo: body.memo?.trim() || "",
    status: body.status || "wishlist",
    favorite: Boolean(body.favorite),
    created_by: body.created_by || "함께",
    photo_urls: Array.isArray(body.photo_urls) ? body.photo_urls : [],
  };

  const response = await fetch(`${cfg.url}/rest/v1/date_ideas`, {
    method: "POST",
    headers: headers(cfg.key, { Prefer: "return=representation" }),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PATCH(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const body = (await request.json()) as DateIdeaPayload;
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "title",
    "category",
    "place",
    "planned_date",
    "budget",
    "memo",
    "status",
    "favorite",
    "created_by",
    "photo_urls",
  ] as const) {
    if (body[key] !== undefined) allowed[key] = body[key];
  }
  allowed.updated_at = new Date().toISOString();

  const query = new URLSearchParams({ id: `eq.${id}`, couple_code: `eq.${cfg.coupleCode}` });
  const response = await fetch(`${cfg.url}/rest/v1/date_ideas?${query.toString()}`, {
    method: "PATCH",
    headers: headers(cfg.key, { Prefer: "return=representation" }),
    body: JSON.stringify(allowed),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const query = new URLSearchParams({ id: `eq.${id}`, couple_code: `eq.${cfg.coupleCode}` });
  const response = await fetch(`${cfg.url}/rest/v1/date_ideas?${query.toString()}`, {
    method: "DELETE",
    headers: headers(cfg.key, { Prefer: "return=representation" }),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
