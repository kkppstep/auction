import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "car-photos";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const coverImage = formData.get("cover_image") as File | null;

  let coverImageUrl: string | null = null;
  if (coverImage && coverImage.size > 0) {
    const ext = coverImage.name.split(".").pop() || "jpg";
    const path = `sale/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await coverImage.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: coverImage.type });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    coverImageUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data
      .publicUrl;
  }

  const payload = {
    title: formData.get("title") as string,
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
    cover_image_url: coverImageUrl,
  };

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
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  const { error } = await supabaseAdmin.from("cars").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from("cars").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
