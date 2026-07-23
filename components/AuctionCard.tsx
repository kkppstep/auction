"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, Share2, Tag } from "lucide-react";

export type AuctionPhoto = {
  id: string;
  image_url: string;
};

export default function AuctionCard({
  photo,
  caption,
  likesCount,
  car,
  onOffer,
}: {
  photo: AuctionPhoto;
  caption: string | null;
  likesCount: number;
  car?: { title: string | null } | null;
  onOffer: (photo: AuctionPhoto) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likesCount ?? 0);

  function toggleLike() {
    setLiked((v) => !v);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
  }

  async function handleShare() {
    const shareData = {
      title: "YBC — Your Board Car",
      text: caption ?? car?.title ?? "ကားတစ်စီးကြည့်ပါ",
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import("@capacitor/share");
        await Share.share(shareData);
        return;
      }
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {
      /* user cancelled share sheet, ignore */
    }
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-surface">
      {/* blurred fill behind — keeps the immersive full-bleed look for
          photos whose aspect ratio doesn't match the screen, without
          cropping the actual photo */}
      <Image
        src={photo.image_url}
        alt=""
        fill
        aria-hidden
        draggable={false}
        className="pointer-events-none scale-110 object-cover opacity-50 blur-2xl"
        sizes="(max-width: 480px) 100vw, 448px"
      />

      {/* the real photo, shown in full — never cropped */}
      <Image
        src={photo.image_url}
        alt={caption ?? "ကားပုံ"}
        fill
        draggable={false}
        className="pointer-events-none object-contain"
        sizes="(max-width: 480px) 100vw, 448px"
        priority
      />

      {/* bottom gradient + car info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 pb-24">
        {car?.title && (
          <p className="font-display text-2xl tracking-wide text-ivory">{car.title}</p>
        )}
        {caption && <p className="mt-0.5 text-sm text-chrome">{caption}</p>}
      </div>

      {/* TikTok-style right action rail */}
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-5">
        <button
          onClick={toggleLike}
          className="flex flex-col items-center gap-1"
          aria-label="Love"
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur ${
              liked ? "bg-ember text-white" : "bg-black/40 text-ivory"
            }`}
          >
            <Heart size={22} fill={liked ? "currentColor" : "none"} />
          </span>
          <span className="text-xs tabular-nums text-ivory drop-shadow">{likeCount}</span>
        </button>

        <button
          onClick={() => onOffer(photo)}
          className="flex flex-col items-center gap-1"
          aria-label="Price offer"
        >
          <span className="gauge-ring flex h-12 w-12 items-center justify-center rounded-full bg-amber text-asphalt">
            <Tag size={20} />
          </span>
          <span className="font-display text-xs tracking-wide text-amber drop-shadow">
            စျေး
          </span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1"
          aria-label="Share"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-ivory backdrop-blur">
            <Share2 size={20} />
          </span>
          <span className="text-xs text-ivory drop-shadow">Share</span>
        </button>
      </div>
    </div>
  );
}
