import BottomNav from "@/components/BottomNav";

// Shared shell for the phone-app-style pages: Auction, Sale, Account.
// A route group (parentheses = invisible in the URL) so these three keep
// their real paths ("/", "/sale", "/account") while sharing this shell —
// separate from /download and /admin, which each get their own look.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
