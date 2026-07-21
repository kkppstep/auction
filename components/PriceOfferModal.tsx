"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2 } from "lucide-react";

export default function PriceOfferModal({
  photoId,
  imageUrl,
  onClose,
}: {
  photoId: string;
  imageUrl: string;
  onClose: () => void;
}) {
  const [offerPrice, setOfferPrice] = useState("");
  const [viberNumber, setViberNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auction_photo_id: photoId,
          image_url: imageUrl,
          offer_price: offerPrice,
          buyer_viber_number: viberNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      // Best-effort: copy the message so it can be pasted into Viber, and
      // open the admin's Viber/Telegram if configured.
      try {
        await navigator.clipboard.writeText(data.message);
      } catch {
        /* clipboard may be unavailable, ignore */
      }

      setSent(true);

      setTimeout(() => {
        if (data.preferredChannel === "telegram" && data.telegramUsername) {
          window.open(
            `https://t.me/${data.telegramUsername}?text=${encodeURIComponent(
              data.message
            )}`,
            "_blank"
          );
        } else if (data.viberNumber) {
          window.location.href = `viber://chat?number=${encodeURIComponent(
            data.viberNumber
          )}`;
        }
      }, 600);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-surface p-5 pb-8"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-wide text-amber">
              စျေးတင်မည်
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-chrome hover:bg-white/5"
              aria-label="ပိတ်မည်"
            >
              <X size={20} />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="text-amber" size={40} />
              <p className="font-body text-ivory">
                သင့်စျေးကို ပို့ပြီးပါပြီ။ Viber သို့ ချိတ်ဆက်နေပါသည်…
              </p>
              <p className="text-sm text-chrome">
                message ကို ကူးယူပြီးပါပြီ — Viber ဖွင့်ပြီးရင် paste
                လုပ်ပို့နိုင်ပါသည်။
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-chrome">ပေးနိုင်သော စျေး</span>
                <input
                  required
                  inputMode="numeric"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="ဥပမာ - 25,000,000 ကျပ်"
                  className="rounded-xl border border-white/10 bg-surface2 px-4 py-3 text-ivory outline-none focus:border-amber"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-chrome">
                  သင့် Viber နံပါတ်
                </span>
                <input
                  required
                  type="tel"
                  value={viberNumber}
                  onChange={(e) => setViberNumber(e.target.value)}
                  placeholder="09xxxxxxxxx"
                  className="rounded-xl border border-white/10 bg-surface2 px-4 py-3 text-ivory outline-none focus:border-amber"
                />
              </label>

              {error && <p className="text-sm text-ember">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber py-3.5 font-display text-lg tracking-wide text-asphalt disabled:opacity-60"
              >
                <Send size={18} />
                {submitting ? "ပို့နေသည်…" : "Viber သို့ ပို့မည်"}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
