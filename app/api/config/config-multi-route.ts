import { NextResponse } from "next/server";

export async function GET() {
  const cloudEnabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const legacyAvailable = cloudEnabled && Boolean(process.env.COUPLE_CODE && process.env.COUPLE_PIN);
  return NextResponse.json({ cloudEnabled, legacyAvailable });
}
