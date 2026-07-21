import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BUCKET, storagePathFromPublicUrl } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `auction/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrl } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    const { data: row, error: insertError } = await supabaseAdmin
      .from("auction_photos")
      .insert({ image_url: publicUrl.publicUrl, post_id: params.postId })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, photo: row });
  } catch (err: any) {
    console.error("Post photo upload error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}

// Remove a single photo from a post. If it was the last photo, the now-empty
// post is deleted too so buyers never see a blank post.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { photoId } = await req.json();
    if (!photoId) return NextResponse.json({ error: "photoId is required." }, { status: 400 });

    const { data: photo } = await supabaseAdmin
      .from("auction_photos")
      .select("image_url")
      .eq("id", photoId)
      .single();

    if (photo) {
      const path = storagePathFromPublicUrl(photo.image_url);
      if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
    }

    const { error } = await supabaseAdmin.from("auction_photos").delete().eq("id", photoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { count } = await supabaseAdmin
      .from("auction_photos")
      .select("id", { count: "exact", head: true })
      .eq("post_id", params.postId);

    if (!count) {
      await supabaseAdmin.from("auction_posts").delete().eq("id", params.postId);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Post photo delete error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}
