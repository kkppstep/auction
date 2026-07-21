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
 * Purely presentational — photoIndex is owned by AuctionFeed, since a
 * single drag gesture on the outer card decides both photo (x-axis) and
 * post (y-axis) navigation. This component just renders the current photo
 * and the within-post progress dots.
 */
export default function AuctionPostCard({
  post,
  photoIndex,
  onOffer,
}: {
  post: AuctionPost;
  photoIndex: number;
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
        car={post.cars}
        onOffer={onOffer}
      />

      {photos.length > 1 && (
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
      )}
    </div>
  );
}
