import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

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

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "photo.jpg";
}

export async function POST(request: NextRequest) {
  const cfg = env();
  if (!cfg) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "wrong_pin" }, { status: 401 });

  const form = await request.formData();
  const files = form.getAll("photos").filter((value): value is File => value instanceof File);
  if (!files.length) return NextResponse.json({ error: "no_photos" }, { status: 400 });
  if (files.length > 4) return NextResponse.json({ error: "max_4_photos" }, { status: 400 });

  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "images_only" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "photo_too_large" }, { status: 400 });
    }

    const path = `${cfg.coupleCode}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(`${cfg.url}/storage/v1/object/date-photos/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!upload.ok) {
      const text = await upload.text();
      return NextResponse.json({ error: "upload_failed", detail: text }, { status: 500 });
    }
    urls.push(`${cfg.url}/storage/v1/object/public/date-photos/${encodedPath}`);
  }

  return NextResponse.json({ urls });
}
