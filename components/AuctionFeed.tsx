"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/client";
import AuctionPostCard, { AuctionPost } from "./AuctionPostCard";
import { AuctionPhoto } from "./AuctionCard";
import PriceOfferModal from "./PriceOfferModal";

const SWIPE_THRESHOLD = 80;

export default function AuctionFeed() {
  const [posts, setPosts] = useState<AuctionPost[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offerPhoto, setOfferPhoto] = useState<AuctionPhoto | null>(null);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabaseBrowser
        .from("auction_posts")
        .select("id, caption, likes_count, cars(title), auction_photos(id, image_url)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .order("created_at", { foreignTable: "auction_photos", ascending: true });

      // Posts with zero photos (shouldn't normally happen, but be defensive)
      // shouldn't show up as blank cards.
      const withPhotos = ((data as unknown as AuctionPost[]) ?? []).filter(
        (p) => p.auction_photos?.length > 0
      );

      if (active) {
        setPosts(withPhotos);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -SWIPE_THRESHOLD && index < posts.length - 1) {
      setDirection(1);
      setIndex((i) => i + 1);
    } else if (info.offset.y > SWIPE_THRESHOLD && index > 0) {
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

  if (posts.length === 0) {
    return (
      <div className="flex h-[calc(100vh-9rem)] flex-col items-center justify-center gap-2 px-8 text-center text-chrome">
        <p className="font-display text-2xl text-ivory">
          အခုလောလောဆယ် Auction ကားမရှိသေးပါ
        </p>
        <p className="text-sm">မကြာမီ admin မှ ကားပုံများ တင်ပေးပါလိမ့်မည်။</p>
      </div>
    );
  }

  const current = posts[index];

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full overflow-hidden px-3 pt-3">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={current.id}
          className="h-full w-full"
          custom={direction}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
          initial={{ y: direction >= 0 ? 60 : -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: direction >= 0 ? -60 : 60, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 260 }}
        >
          <AuctionPostCard post={current} onOffer={setOfferPhoto} />
        </motion.div>
      </AnimatePresence>

      {/* post-position indicator (right edge, vertical) */}
      <div className="pointer-events-none absolute bottom-3 right-1 top-3 flex w-1 flex-col gap-1">
        {posts.map((p, i) => (
          <span
            key={p.id}
            className={`flex-1 rounded-full ${i === index ? "bg-amber" : "bg-white/15"}`}
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
