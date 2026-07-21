import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const [{ data: photos }, { data: cars }, { data: offers }, { data: settings }] =
      await Promise.all([
        supabaseAdmin
          .from("auction_photos")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("cars").select("*").order("created_at", { ascending: false }),
        supabaseAdmin
          .from("offers")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin.from("settings").select("key, value"),
      ]);

    return NextResponse.json({
      photos: photos ?? [],
      cars: cars ?? [],
      offers: offers ?? [],
      settings: Object.fromEntries((settings ?? []).map((s) => [s.key, s.value])),
    });
  } catch (err: any) {
    console.error("Admin data error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}
