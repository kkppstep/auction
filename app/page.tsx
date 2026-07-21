import AuctionFeed from "@/components/AuctionFeed";

export default function HomePage() {
  return (
    <div>
      <header className="flex items-center justify-between px-4 pt-4">
        <h1 className="font-display text-3xl tracking-wide text-ivory">
          YBC <span className="text-amber">Auction</span>
        </h1>
      </header>
      <AuctionFeed />
    </div>
  );
}
