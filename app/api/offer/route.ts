import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendPushToAdmins } from "@/lib/push";

export async function POST(req: NextRequest) {
  try {
    const { auction_photo_id, image_url, offer_price, buyer_viber_number } =
      await req.json();

    if (!offer_price || !buyer_viber_number) {
      return NextResponse.json(
        { error: "ပေးနိုင်သော စျေး နှင့် Viber နံပါတ် လိုအပ်ပါသည်။" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("offers").insert({
      auction_photo_id,
      image_url,
      offer_price,
      buyer_viber_number,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the admin's device(s) — best-effort, never blocks the buyer's
    // own flow if push isn't configured or a token has gone stale.
    try {
      await sendPushToAdmins(
        "YBC — New price offer",
        `${offer_price} · Viber ${buyer_viber_number}`,
        { type: "offer", image_url: image_url ?? "" }
      );
    } catch (pushErr) {
      console.error("Push notify failed:", pushErr);
    }

    // Pull the admin's current contact routing so the client can open
    // Viber / Telegram with the offer pre-filled.
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("key, value");

    const settingsMap = Object.fromEntries(
      (settings ?? []).map((s) => [s.key, s.value])
    );

    const message = `YBC ခ်စ်ကားပွဲ - စျေးတင်ခြင်း\nပုံ- ${image_url}\nပေးနိုင်သော စျေး- ${offer_price}\nဆက်သွယ်ရန် Viber- ${buyer_viber_number}`;

    return NextResponse.json({
      ok: true,
      message,
      viberNumber: settingsMap.admin_viber_number ?? null,
      telegramUsername: settingsMap.admin_telegram_username ?? null,
      preferredChannel: settingsMap.preferred_channel ?? "viber",
    });
  } catch (err: any) {
    console.error("Offer submission error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error." },
      { status: 500 }
    );
  }
}
