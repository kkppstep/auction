/**
 * Sends a message to admin's Telegram chat via a bot. This is a proper
 * server-to-server notification — unlike the buyer's device trying to
 * open viber://, this always works as long as the bot token/chat ID are
 * configured, regardless of what apps the buyer has installed.
 */
export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "Telegram not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing) — skipping."
    );
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error("Telegram send failed:", await res.text());
    }
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}
