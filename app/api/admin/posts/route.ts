import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BUCKET, storagePathFromPublicUrl } from "@/lib/storage";

// Create an (initially empty) post. The client then uploads photos into it
// one at a time via /api/admin/posts/[postId]/photos — keeping each request
// small so 50+ photo batches never hit Vercel's request size/time limits.
export async function POST(req: NextRequest) {
  try {
    const { caption, car_id } = await req.json();

    const { data, error } = await supabaseAdmin
      .from("auction_posts")
      .insert({ caption: caption || null, car_id: car_id || null })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, post: data });
  } catch (err: any) {
    console.error("Post create error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}

// Edit a post's caption / linked car / visibility.
export async function PATCH(req: NextRequest) {
  try {
    const { id, caption, car_id, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (caption !== undefined) updates.caption = caption;
    if (car_id !== undefined) updates.car_id = car_id || null;
    if (is_active !== undefined) updates.is_active = is_active;

    const { error } = await supabaseAdmin.from("auction_posts").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Post update error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}

// Delete a whole post: clean up every photo's storage file, then delete the
// post row (auction_photos rows cascade-delete automatically).
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const { data: photos } = await supabaseAdmin
      .from("auction_photos")
      .select("image_url")
      .eq("post_id", id);

    const paths = (photos ?? [])
      .map((p) => storagePathFromPublicUrl(p.image_url))
      .filter((p): p is string => !!p);

    if (paths.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(paths);
    }

    const { error } = await supabaseAdmin.from("auction_posts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Post delete error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}
