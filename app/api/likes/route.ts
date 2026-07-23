import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

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
    const { post_id, device_id, liked } = await req.json();

    if (!post_id || !device_id || typeof liked !== "boolean") {
      return json({ error: "post_id, device_id, and liked are required." }, 400);
    }

    if (liked) {
      // ON CONFLICT DO NOTHING — if this device already liked this post,
      // the insert is a no-op and the count doesn't move.
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("post_likes")
        .upsert({ post_id, device_id }, { onConflict: "post_id,device_id", ignoreDuplicates: true })
        .select();

      if (insertError) return json({ error: insertError.message }, 500);

      let likesCount: number | null = null;
      if (inserted && inserted.length > 0) {
        const { data } = await supabaseAdmin.rpc("increment_post_likes", {
          p_post_id: post_id,
          p_delta: 1,
        });
        likesCount = data;
      } else {
        const { data } = await supabaseAdmin
          .from("auction_posts")
          .select("likes_count")
          .eq("id", post_id)
          .single();
        likesCount = data?.likes_count ?? null;
      }

      return json({ ok: true, likes_count: likesCount });
    } else {
      const { data: deleted, error: deleteError } = await supabaseAdmin
        .from("post_likes")
        .delete()
        .eq("post_id", post_id)
        .eq("device_id", device_id)
        .select();

      if (deleteError) return json({ error: deleteError.message }, 500);

      let likesCount: number | null = null;
      if (deleted && deleted.length > 0) {
        const { data } = await supabaseAdmin.rpc("increment_post_likes", {
          p_post_id: post_id,
          p_delta: -1,
        });
        likesCount = data;
      } else {
        const { data } = await supabaseAdmin
          .from("auction_posts")
          .select("likes_count")
          .eq("id", post_id)
          .single();
        likesCount = data?.likes_count ?? null;
      }

      return json({ ok: true, likes_count: likesCount });
    }
  } catch (err: any) {
    console.error("Like toggle error:", err);
    return json({ error: err?.message ?? "Unexpected server error." }, 500);
  }
}
