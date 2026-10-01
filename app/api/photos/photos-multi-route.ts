import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeCouple } from "../../../lib/couple";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "photo.jpg";
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCouple(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await request.formData();
  const files = form.getAll("photos").filter((value): value is File => value instanceof File);
  if (!files.length) return NextResponse.json({ error: "no_photos" }, { status: 400 });
  if (files.length > 4) return NextResponse.json({ error: "max_4_photos" }, { status: 400 });

  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "images_only" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "photo_too_large" }, { status: 400 });

    const path = `${auth.coupleCode}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(`${auth.cfg.url}/storage/v1/object/date-photos/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: auth.cfg.key,
        Authorization: `Bearer ${auth.cfg.key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!upload.ok) {
      const text = await upload.text();
      return NextResponse.json({ error: "upload_failed", detail: text }, { status: 500 });
    }
    urls.push(`${auth.cfg.url}/storage/v1/object/public/date-photos/${encodedPath}`);
  }
  return NextResponse.json({ urls });
}
