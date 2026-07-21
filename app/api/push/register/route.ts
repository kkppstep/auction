import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { token, platform } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "token is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("push_tokens")
      .upsert({ token, platform: platform ?? "android" }, { onConflict: "token" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Push token register error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}
