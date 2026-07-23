"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import AuctionPostCard, { AuctionPost } from "./AuctionPostCard";
import { AuctionPhoto } from "./AuctionCard";
import PriceOfferModal from "./PriceOfferModal";

const SWIPE_THRESHOLD = 60;

type Transition = { axis: "x" | "y"; direction: 1 | -1 } | null;

export default function AuctionFeed() {
  const [posts, setPosts] = useState<AuctionPost[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [postIndex, setPostIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offerPhoto, setOfferPhoto] = useState<AuctionPhoto | null>(null);
  const [transition, setTransition] = useState<Transition>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const deviceId = getDeviceId();

      const [{ data }, { data: likedRows }] = await Promise.all([
        supabaseBrowser
          .from("auction_posts")
          .select("id, caption, likes_count, cars(title), auction_photos(id, image_url)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .order("created_at", { foreignTable: "auction_photos", ascending: true }),
        supabaseBrowser.from("post_likes").select("post_id").eq("device_id", deviceId),
      ]);

      const withPhotos = ((data as unknown as AuctionPost[]) ?? []).filter(
        (p) => p.auction_photos?.length > 0
      );

      if (active) {
        setPosts(withPhotos);
        setLikedPostIds(new Set((likedRows ?? []).map((r) => r.post_id)));
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const currentPost = posts[postIndex];

  async function toggleLike(postId: string) {
    const wasLiked = likedPostIds.has(postId);
    const delta = wasLiked ? -1 : 1;

    // Optimistic update — feels instant, reconciled with the server's
    // authoritative count once the response comes back.
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count + delta) } : p
      )
    );

    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          device_id: getDeviceId(),
          liked: !wasLiked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Sync to the real server count in case of any race with another buyer.
      if (typeof data.likes_count === "number") {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, likes_count: data.likes_count } : p))
        );
      }
    } catch {
      // Revert on failure.
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - delta) } : p
        )
      );
    }
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { x, y } = info.offset;

    // Whichever axis moved further decides the gesture — horizontal browses
    // photos inside the current post, vertical moves between posts.
    if (Math.abs(x) > Math.abs(y)) {
      if (Math.abs(x) < SWIPE_THRESHOLD) return;
      const photos = currentPost.auction_photos;
      if (x < 0 && photoIndex < photos.length - 1) {
        setTransition({ axis: "x", direction: 1 });
        setPhotoIndex((i) => i + 1);
      } else if (x > 0 && photoIndex > 0) {
        setTransition({ axis: "x", direction: -1 });
        setPhotoIndex((i) => i - 1);
      }
    } else {
      if (Math.abs(y) < SWIPE_THRESHOLD) return;
      if (y < 0 && postIndex < posts.length - 1) {
        setTransition({ axis: "y", direction: 1 });
        setPostIndex((i) => i + 1);
        setPhotoIndex(0);
      } else if (y > 0 && postIndex > 0) {
        setTransition({ axis: "y", direction: -1 });
        setPostIndex((i) => i - 1);
        setPhotoIndex(0);
      }
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 mx-auto flex max-w-md items-center justify-center bg-asphalt text-chrome">
        Auction ကားများ တင်နေသည်…
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="fixed inset-0 mx-auto flex max-w-md flex-col items-center justify-center gap-2 bg-asphalt px-8 text-center text-chrome">
        <p className="font-display text-2xl text-ivory">
          အခုလောလောဆယ် Auction ကားမရှိသေးပါ
        </p>
        <p className="text-sm">မကြာမီ admin မှ ကားပုံများ တင်ပေးပါလိမ့်မည်။</p>
      </div>
    );
  }

  const offsetFor = (dir: 1 | -1, axis: "x" | "y") => {
    const distance = axis === "x" ? 70 : 60;
    return dir >= 0 ? distance : -distance;
  };

  const initial =
    transition == null
      ? { opacity: 1 }
      : transition.axis === "x"
      ? { x: offsetFor(transition.direction, "x"), opacity: 0 }
      : { y: offsetFor(transition.direction, "y"), opacity: 0 };

  const exit =
    transition == null
      ? { opacity: 0 }
      : transition.axis === "x"
      ? { x: -offsetFor(transition.direction, "x"), opacity: 0 }
      : { y: -offsetFor(transition.direction, "y"), opacity: 0 };

  return (
    <div className="fixed inset-0 mx-auto max-w-md overflow-hidden bg-asphalt">
      {/* subtle floating wordmark instead of a boxed header — content stays full-bleed behind it */}
      <div className="pointer-events-none absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-30">
        <p className="font-display text-xl tracking-wide text-ivory drop-shadow-lg">
          YBC <span className="text-amber">Auction</span>
        </p>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={`${currentPost.id}-${photoIndex}`}
          className="h-full w-full"
          drag
          dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
          initial={initial}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={exit}
          transition={{ type: "spring", damping: 30, stiffness: 260 }}
        >
          <AuctionPostCard
            post={currentPost}
            photoIndex={photoIndex}
            liked={likedPostIds.has(currentPost.id)}
            onToggleLike={() => toggleLike(currentPost.id)}
            onOffer={setOfferPhoto}
          />
        </motion.div>
      </AnimatePresence>

      {/* post-position indicator (right edge, vertical) */}
      <div className="pointer-events-none absolute bottom-3 right-1 top-3 flex w-1 flex-col gap-1">
        {posts.map((p, i) => (
          <span
            key={p.id}
            className={`flex-1 rounded-full ${i === postIndex ? "bg-amber" : "bg-white/15"}`}
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
