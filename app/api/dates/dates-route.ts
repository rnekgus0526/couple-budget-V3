import { NextRequest, NextResponse } from "next/server";
import { authorizeCouple, supabaseHeaders } from "../../../lib/couple";

type DateIdeaPayload = {
  title?: string;
  category?: string;
  place?: string;
  planned_date?: string | null;
  budget?: number | null;
  memo?: string;
  status?: "wishlist" | "planned" | "done";
  favorite?: boolean;
  created_by?: string;
  photo_urls?: string[];
};

export async function GET(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const query = new URLSearchParams({
    couple_code: `eq.${auth.coupleCode}`,
    order: "created_at.desc",
  });
  const response = await fetch(`${auth.cfg.url}/rest/v1/date_ideas?${query.toString()}`, {
    headers: supabaseHeaders(auth.cfg.key),
    cache: "no-store",
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as DateIdeaPayload;
  if (!body.title?.trim() || !body.category?.trim()) {
    return NextResponse.json({ error: "title_and_category_required" }, { status: 400 });
  }

  const payload = {
    couple_code: auth.coupleCode,
    title: body.title.trim().slice(0, 140),
    category: body.category.trim().slice(0, 40),
    place: body.place?.trim().slice(0, 220) || "",
    planned_date: body.planned_date || null,
    budget: typeof body.budget === "number" ? body.budget : null,
    memo: body.memo?.trim().slice(0, 2000) || "",
    status: body.status || "wishlist",
    favorite: Boolean(body.favorite),
    created_by: String(body.created_by || "함께").trim().slice(0, 80) || "함께",
    photo_urls: Array.isArray(body.photo_urls) ? body.photo_urls : [],
  };

  const response = await fetch(`${auth.cfg.url}/rest/v1/date_ideas`, {
    method: "POST",
    headers: supabaseHeaders(auth.cfg.key, { Prefer: "return=representation" }),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const body = (await request.json()) as DateIdeaPayload;
  const allowed: Record<string, unknown> = {};
  for (const key of ["title", "category", "place", "planned_date", "budget", "memo", "status", "favorite", "created_by", "photo_urls"] as const) {
    if (body[key] !== undefined) allowed[key] = body[key];
  }
  if (typeof allowed.created_by === "string") allowed.created_by = allowed.created_by.trim().slice(0, 80) || "함께";
  allowed.updated_at = new Date().toISOString();

  const query = new URLSearchParams({ id: `eq.${id}`, couple_code: `eq.${auth.coupleCode}` });
  const response = await fetch(`${auth.cfg.url}/rest/v1/date_ideas?${query.toString()}`, {
    method: "PATCH",
    headers: supabaseHeaders(auth.cfg.key, { Prefer: "return=representation" }),
    body: JSON.stringify(allowed),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const query = new URLSearchParams({ id: `eq.${id}`, couple_code: `eq.${auth.coupleCode}` });
  const response = await fetch(`${auth.cfg.url}/rest/v1/date_ideas?${query.toString()}`, {
    method: "DELETE",
    headers: supabaseHeaders(auth.cfg.key, { Prefer: "return=representation" }),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
