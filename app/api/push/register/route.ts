import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Called cross-origin by the bundled Android app — public, no cookies, so
// a wide-open CORS policy is safe here (same reasoning as /api/offer).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const { token, platform } = await req.json();
    if (!token) {
      return json({ error: "token is required." }, 400);
    }

    const { error } = await supabaseAdmin
      .from("push_tokens")
      .upsert({ token, platform: platform ?? "android" }, { onConflict: "token" });

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (err: any) {
    console.error("Push token register error:", err);
    return json({ error: err?.message ?? "Unexpected server error." }, 500);
  }
}
