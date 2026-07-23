import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";

// This route is called cross-origin by the bundled Android app (which has
// no backend of its own — it's a static local bundle). It's public and
// carries no cookies/session, so a wide-open CORS policy here is safe.
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
    const { auction_photo_id, image_url, offer_price, buyer_viber_number } =
      await req.json();

    if (!offer_price || !buyer_viber_number) {
      return json(
        { error: "ပေးနိုင်သော စျေး နှင့် Viber နံပါတ် လိုအပ်ပါသည်။" },
        400
      );
    }

    const { error } = await supabaseAdmin.from("offers").insert({
      auction_photo_id,
      image_url,
      offer_price,
      buyer_viber_number,
    });

    if (error) {
      return json({ error: error.message }, 500);
    }

    // Pull the admin's current contact routing (Viber, Telegram username,
    // phone number for the "call me" follow-up action).
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("key, value");

    const settingsMap = Object.fromEntries(
      (settings ?? []).map((s) => [s.key, s.value])
    );

    const message = `YBC ခ်စ်ကားပွဲ - စျေးတင်ခြင်း\nပုံ- ${image_url}\nပေးနိုင်သော စျေး- ${offer_price}\nဆက်သွယ်ရန် Viber- ${buyer_viber_number}`;

    // Reliable server-side notification to admin — doesn't depend on the
    // buyer's device having any particular app installed. Best-effort:
    // never fails the offer itself if Telegram isn't configured.
    sendTelegramMessage(message).catch((err) =>
      console.error("Telegram notify failed:", err)
    );

    return json({
      ok: true,
      message,
      viberNumber: settingsMap.admin_viber_number ?? null,
      telegramUsername: settingsMap.admin_telegram_username ?? null,
      phoneNumber: settingsMap.admin_phone_number ?? null,
      preferredChannel: settingsMap.preferred_channel ?? "viber",
    });
  } catch (err: any) {
    console.error("Offer submission error:", err);
    return json({ error: err?.message ?? "Unexpected server error." }, 500);
  }
}
