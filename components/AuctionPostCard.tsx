"use client";

import { useState } from "react";
import AuctionCard, { AuctionPhoto } from "./AuctionCard";

export type AuctionPost = {
  id: string;
  caption: string | null;
  likes_count: number;
  auction_photos: AuctionPhoto[];
  cars?: { title: string | null } | null;
};

export default function AuctionPostCard({
  post,
  onOffer,
}: {
  post: AuctionPost;
  onOffer: (photo: AuctionPhoto) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = post.auction_photos;
  const current = photos[Math.min(photoIndex, photos.length - 1)];

  return (
    <div className="relative h-full w-full">
      <AuctionCard
        photo={current}
        caption={post.caption}
        likesCount={post.likes_count}
        car={post.cars}
        onOffer={onOffer}
      />

      {/* invisible left/right tap zones — only active when a post has more
          than one photo, so single-photo posts aren't affected */}
      {photos.length > 1 && (
        <>
          <button
            aria-label="ရှေ့ပုံ"
            onClick={() => setPhotoIndex((i) => Math.max(0, i - 1))}
            className="absolute left-0 top-0 z-10 h-[45%] w-1/2"
          />
          <button
            aria-label="နောက်ပုံ"
            onClick={() => setPhotoIndex((i) => Math.min(photos.length - 1, i + 1))}
            className="absolute right-0 top-0 z-10 h-[45%] w-1/2"
          />
          {/* photo-position dots, scoped to this post only */}
          <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex gap-1">
            {photos.map((p, i) => (
              <span
                key={p.id}
                className={`h-0.5 flex-1 rounded-full ${
                  i === photoIndex ? "bg-ivory" : "bg-white/25"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
