import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BUCKET, storagePathFromPublicUrl } from "@/lib/storage";

async function uploadCoverImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `sale/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type });
  if (error) throw new Error(error.message);
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function fieldsFromForm(formData: FormData) {
  return {
    title: (formData.get("title") as string) || undefined,
    brand: (formData.get("brand") as string) || null,
    model: (formData.get("model") as string) || null,
    year: formData.get("year") ? Number(formData.get("year")) : null,
    power: (formData.get("power") as string) || null,
    price: formData.get("price") ? Number(formData.get("price")) : null,
    mileage: (formData.get("mileage") as string) || null,
    transmission: (formData.get("transmission") as string) || null,
    fuel_type: (formData.get("fuel_type") as string) || null,
    color: (formData.get("color") as string) || null,
    description: (formData.get("description") as string) || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const coverImage = formData.get("cover_image") as File | null;

    let coverImageUrl: string | null = null;
    if (coverImage && coverImage.size > 0) {
      coverImageUrl = await uploadCoverImage(coverImage);
    }

    const payload = { ...fieldsFromForm(formData), cover_image_url: coverImageUrl };

    if (!payload.title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("cars")
      .insert(payload)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, car: data });
  } catch (err: any) {
    console.error("Car create error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}

// Accepts either:
//  - JSON body { id, status } for the quick "mark sold/for sale" toggle, or
//  - multipart FormData { id, title, brand, ..., cover_image? } for a full edit
export async function PATCH(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const { id, status } = await req.json();
      if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
      const { error } = await supabaseAdmin.from("cars").update({ status }).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const formData = await req.formData();
    const id = formData.get("id") as string;
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const updates: Record<string, unknown> = fieldsFromForm(formData);

    const coverImage = formData.get("cover_image") as File | null;
    if (coverImage && coverImage.size > 0) {
      // Clean up the old cover image so replaced photos don't pile up in storage.
      const { data: existing } = await supabaseAdmin
        .from("cars")
        .select("cover_image_url")
        .eq("id", id)
        .single();
      if (existing?.cover_image_url) {
        const oldPath = storagePathFromPublicUrl(existing.cover_image_url);
        if (oldPath) await supabaseAdmin.storage.from(BUCKET).remove([oldPath]);
      }
      updates.cover_image_url = await uploadCoverImage(coverImage);
    }

    if (!updates.title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("cars").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Car update error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from("cars")
      .select("cover_image_url")
      .eq("id", id)
      .single();

    if (existing?.cover_image_url) {
      const path = storagePathFromPublicUrl(existing.cover_image_url);
      if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
    }

    const { error } = await supabaseAdmin.from("cars").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Car delete error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}
