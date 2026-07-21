"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Car, UserRound } from "lucide-react";

const TABS = [
  { href: "/", label: "Auction", icon: Gauge },
  { href: "/sale", label: "Sale", icon: Car },
  { href: "/account", label: "Account", icon: UserRound },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide the shopper nav inside the admin area.
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-white/10 bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="flex flex-col items-center gap-1 py-2.5 text-xs"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    active ? "bg-amber/15 text-amber gauge-ring" : "text-chrome"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span
                  className={`font-display tracking-wide ${
                    active ? "text-amber" : "text-chrome"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
