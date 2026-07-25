import AuctionFeed from "@/components/AuctionFeed";

// No header, no padding — the feed itself is full-bleed edge-to-edge like
// TikTok/Reels. AuctionFeed renders its own small floating YBC wordmark.
export default function HomePage() {
  return <AuctionFeed />;
}
