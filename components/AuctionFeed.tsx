"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/client";
import AuctionCard, { AuctionPhoto } from "./AuctionCard";
import PriceOfferModal from "./PriceOfferModal";

const SWIPE_THRESHOLD = 80;

export default function AuctionFeed() {
  const [photos, setPhotos] = useState<AuctionPhoto[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offerPhoto, setOfferPhoto] = useState<AuctionPhoto | null>(null);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabaseBrowser
        .from("auction_photos")
        .select("id, image_url, caption, likes_count, cars(title, model, price)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (active) {
        setPhotos((data as unknown as AuctionPhoto[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD && index < photos.length - 1) {
      setDirection(1);
      setIndex((i) => i + 1);
    } else if (info.offset.x > SWIPE_THRESHOLD && index > 0) {
      setDirection(-1);
      setIndex((i) => i - 1);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-9rem)] items-center justify-center text-chrome">
        Auction ကားများ တင်နေသည်…
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex h-[calc(100vh-9rem)] flex-col items-center justify-center gap-2 px-8 text-center text-chrome">
        <p className="font-display text-2xl text-ivory">
          အခုလောလောဆယ် Auction ကားမရှိသေးပါ
        </p>
        <p className="text-sm">မကြာမီ admin မှ ကားပုံများ တင်ပေးပါလိမ့်မည်။</p>
      </div>
    );
  }

  const current = photos[index];

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full overflow-hidden px-3 pt-3">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={current.id}
          className="h-full w-full"
          custom={direction}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
          initial={{ x: direction >= 0 ? 60 : -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction >= 0 ? -60 : 60, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 260 }}
        >
          <AuctionCard photo={current} onOffer={setOfferPhoto} />
        </motion.div>
      </AnimatePresence>

      {/* progress dots */}
      <div className="pointer-events-none absolute left-0 right-0 top-1 flex justify-center gap-1.5">
        {photos.map((p, i) => (
          <span
            key={p.id}
            className={`h-1 flex-1 max-w-8 rounded-full ${
              i === index ? "bg-amber" : "bg-white/15"
            }`}
          />
        ))}
      </div>

      {offerPhoto && (
        <PriceOfferModal
          photoId={offerPhoto.id}
          imageUrl={offerPhoto.image_url}
          onClose={() => setOfferPhoto(null)}
        />
      )}
    </div>
  );
}
