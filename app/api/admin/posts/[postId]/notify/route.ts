import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendPushToAllDevices } from "@/lib/push";

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { data: post } = await supabaseAdmin
      .from("auction_posts")
      .select("caption")
      .eq("id", params.postId)
      .single();

    await sendPushToAllDevices(
      "YBC — ကားအသစ်များ ရောက်ရှိပါပြီ",
      post?.caption || "Auction တွင် ကားအသစ်များ ကြည့်ရှုနိုင်ပါပြီ",
      { type: "new_post", post_id: params.postId }
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Post notify error:", err);
    // Best-effort — the post itself is already saved either way, so this
    // failing shouldn't look like the upload failed.
    return NextResponse.json({ ok: false, error: err?.message }, { status: 200 });
  }
}
