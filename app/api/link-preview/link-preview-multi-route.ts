import { NextRequest, NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value?: string | null) {
  return decodeEntities(String(value || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function titleFromHtml(html: string) {
  return cleanText(meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/\s*[|•-]\s*Instagram.*$/i, "")
    .replace(/\s*[|•-]\s*Facebook.*$/i, "")
    .replace(/^.*? on Instagram:\s*[“\"]?/i, "")
    .replace(/[”\"]?\s*•\s*Instagram.*$/i, "")
    .trim();
}

function flattenJsonLd(value: unknown, out: JsonObject[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonLd(item, out));
  } else if (value && typeof value === "object") {
    const obj = value as JsonObject;
    out.push(obj);
    Object.values(obj).forEach((item) => flattenJsonLd(item, out));
  }
  return out;
}

function addressFromObject(obj: JsonObject) {
  const address = obj.address;
  if (typeof address === "string") return cleanText(address);
  if (!address || typeof address !== "object") return "";
  const a = address as JsonObject;
  const line1 = cleanText(String(a.streetAddress || ""));
  const locality = cleanText(String(a.addressLocality || ""));
  const region = cleanText(String(a.addressRegion || ""));
  const postcode = cleanText(String(a.postalCode || ""));
  const countryValue = a.addressCountry;
  const country = typeof countryValue === "string"
    ? cleanText(countryValue)
    : countryValue && typeof countryValue === "object"
      ? cleanText(String((countryValue as JsonObject).name || ""))
      : "";
  return [line1, [locality, region, postcode].filter(Boolean).join(" "), country]
    .filter(Boolean)
    .join(", ");
}

function jsonLdInfo(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let name = "";
  let address = "";
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]);
      for (const obj of flattenJsonLd(parsed)) {
        if (!name && typeof obj.name === "string") name = cleanText(obj.name);
        if (!address) address = addressFromObject(obj);
        if (name && address) return { name, address };
      }
    } catch {
      // Some sites emit invalid JSON-LD; ignore and use meta tags instead.
    }
  }
  return { name, address };
}

function addressFromText(text: string) {
  const cleaned = cleanText(text);
  const au = cleaned.match(/\b\d{1,5}\s+[A-Za-z0-9.'’&()\- ]{2,70}\s(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Parade|Pde|Highway|Hwy|Place|Pl|Crescent|Cres|Circuit|Cct|Terrace|Tce|Close|Cl)\b[^\n|]{0,80}?\b(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}\b/i);
  return au ? cleanText(au[0]) : "";
}

function nameFromSharedText(text: string) {
  const cleaned = cleanText(text).replace(/https?:\/\/\S+/g, "").trim();
  if (!cleaned) return "";
  const first = cleaned.split(/[\n|•]/)[0]?.trim() || "";
  return first.slice(0, 100);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { url?: string; text?: string };
  const raw = String(body.url || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad_protocol");
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  let html = "";
  let finalUrl = parsed.toString();
  try {
    const response = await fetch(parsed, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept-Language": "en-AU,en;q=0.9,ko;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    finalUrl = response.url || finalUrl;
    if (response.ok) html = await response.text();
  } catch {
    // Social sites often block automated preview fetches. Shared text can still be useful.
  }

  const ld = html ? jsonLdInfo(html) : { name: "", address: "" };
  const description = html ? cleanText(meta(html, "og:description") || meta(html, "description")) : "";
  const sharedText = cleanText(body.text || "");
  const name = ld.name || (html ? titleFromHtml(html) : "") || nameFromSharedText(sharedText);
  const address = ld.address || addressFromText(`${description} ${sharedText}`);

  return NextResponse.json({
    name: name.slice(0, 140),
    address: address.slice(0, 220),
    finalUrl,
    partial: !address,
  });
}
