"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2, Phone, MessageCircle } from "lucide-react";

type OfferResponse = {
  ok: boolean;
  message: string;
  viberNumber: string | null;
  telegramUsername: string | null;
  phoneNumber: string | null;
};

export default function PriceOfferModal({
  photoId,
  imageUrl,
  onClose,
}: {
  photoId: string;
  imageUrl: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [viberNumber, setViberNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OfferResponse | null>(null);

  useEffect(() => setMounted(true), []);

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
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const viberChatLink = result?.viberNumber
    ? `https://viber.me/${result.viberNumber.replace(/[^0-9]/g, "")}`
    : null;

  const content = (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-surface p-5"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* drag handle */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-wide text-amber">
              {result ? "ပို့ပြီးပါပြီ" : "စျေးတင်မည်"}
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-chrome hover:bg-white/5"
              aria-label="ပိတ်မည်"
            >
              <X size={20} />
            </button>
          </div>

          {result ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <CheckCircle2 className="text-amber" size={40} />
              <p className="font-body text-lg text-ivory">သင့်စျေးကို ပို့ပြီးပါပြီ</p>
              <p className="text-sm text-chrome">
                တိုက်ရိုက်ဆက်သွယ်လိုပါက အောက်ပါနည်းလမ်းများဖြင့် ဆက်သွယ်နိုင်ပါသည်
              </p>

              <div className="mt-1 flex w-full flex-col gap-2.5">
                {result.phoneNumber && (
                  <a
                    href={`tel:${result.phoneNumber}`}
                    className="flex items-center justify-center gap-2 rounded-xl bg-steel py-3.5 font-display text-lg tracking-wide text-ivory"
                  >
                    <Phone size={18} /> ဖုန်းခေါ်မည် ({result.phoneNumber})
                  </a>
                )}
                {viberChatLink && (
                  <a
                    href={viberChatLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber py-3.5 font-display text-lg tracking-wide text-asphalt"
                  >
                    <MessageCircle size={18} /> Viber ဖြင့် စာပို့မည်
                  </a>
                )}
              </div>
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
                <span className="text-sm text-chrome">သင့် Viber နံပါတ်</span>
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
                {submitting ? "ပို့နေသည်…" : "ပို့မည်"}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  // Rendered via a portal straight to <body> — this modal was getting
  // rendered inside a Framer Motion `drag` element, which applies a CSS
  // transform and (per spec) that creates its own stacking context. Any
  // z-index inside that context is trapped there and can't out-rank
  // elements outside it, like the floating bottom nav — which is exactly
  // why the nav stayed visible/interactive over the modal. Portaling to
  // <body> sidesteps that entirely.
  if (!mounted) return null;
  return createPortal(content, document.body);
}
