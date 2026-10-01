import { NextResponse } from "next/server";

export async function GET() {
  const cloudEnabled = Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.COUPLE_CODE,
  );

  return NextResponse.json({
    cloudEnabled,
    requiresPin: cloudEnabled && Boolean(process.env.COUPLE_PIN),
  });
}
