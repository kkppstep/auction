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

    const result = await sendPushToAllDevices(
      "YBC — ကားအသစ်များ ရောက်ရှိပါပြီ",
      post?.caption || "Auction တွင် ကားအသစ်များ ကြည့်ရှုနိုင်ပါပြီ",
      { type: "new_post", post_id: params.postId }
    );

    // Always 200 here — the post itself is already saved either way, so
    // this failing shouldn't look like the upload failed. The body
    // carries the real diagnostic for the dashboard to show.
    return NextResponse.json({ ok: true, push: result });
  } catch (err: any) {
    console.error("Post notify error:", err);
    return NextResponse.json(
      { ok: false, push: null, error: err?.message },
      { status: 200 }
    );
  }
}
