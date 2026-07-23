"use client";

import AuctionCard, { AuctionPhoto } from "./AuctionCard";

export type AuctionPost = {
  id: string;
  caption: string | null;
  likes_count: number;
  auction_photos: AuctionPhoto[];
  cars?: { title: string | null } | null;
};

/**
 * Purely presentational — photoIndex and liked state are owned by
 * AuctionFeed. Likes belong to the post, not any one photo, and need to
 * survive photo/post navigation remounts, so they can't live locally here.
 */
export default function AuctionPostCard({
  post,
  photoIndex,
  liked,
  onToggleLike,
  onOffer,
}: {
  post: AuctionPost;
  photoIndex: number;
  liked: boolean;
  onToggleLike: () => void;
  onOffer: (photo: AuctionPhoto) => void;
}) {
  const photos = post.auction_photos;
  const current = photos[Math.min(photoIndex, photos.length - 1)];

  return (
    <div className="relative h-full w-full">
      <AuctionCard
        photo={current}
        caption={post.caption}
        likesCount={post.likes_count}
        liked={liked}
        onToggleLike={onToggleLike}
        car={post.cars}
        onOffer={onOffer}
      />

      {photos.length > 1 && (
        <div
          className="pointer-events-none absolute inset-x-3 z-20 flex gap-1"
          style={{ top: "calc(env(safe-area-inset-top) + 3rem)" }}
        >
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={`h-0.5 flex-1 rounded-full ${
                i === photoIndex ? "bg-ivory" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
