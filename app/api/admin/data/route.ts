import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Without this, Next.js may treat this GET route as static and cache its
// response — meaning admin dashboard refreshes could silently serve a
// stale snapshot from before a delete/edit instead of querying Supabase
// again. This forces it to run fresh on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ data: posts }, { data: cars }, { data: offers }, { data: settings }] =
      await Promise.all([
        supabaseAdmin
          .from("auction_posts")
          .select("*, auction_photos(*)")
          .order("created_at", { ascending: false })
          .order("created_at", { foreignTable: "auction_photos", ascending: true }),
        supabaseAdmin.from("cars").select("*").order("created_at", { ascending: false }),
        supabaseAdmin
          .from("offers")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin.from("settings").select("key, value"),
      ]);

    return NextResponse.json({
      posts: posts ?? [],
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
