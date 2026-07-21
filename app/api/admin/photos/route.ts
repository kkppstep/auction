import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "car-photos";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const caption = (formData.get("caption") as string) ?? null;
    const carId = (formData.get("car_id") as string) || null;

    if (!files.length) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }

    const inserted = [];

    for (const file of files) {
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
        .insert({
          image_url: publicUrl.publicUrl,
          caption,
          car_id: carId,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      inserted.push(row);
    }

    return NextResponse.json({ ok: true, photos: inserted });
  } catch (err: any) {
    console.error("Photo upload error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, is_active } = await req.json();
    const { error } = await supabaseAdmin
      .from("auction_photos")
      .update({ is_active })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Photo update error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const { error } = await supabaseAdmin.from("auction_photos").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Photo delete error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}
