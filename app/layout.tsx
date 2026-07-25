import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "YBC — Your Board Car",
  description: "ကားအတွက် Auction၊ အရောင်းနှင့် အကောင့် — YBC Your Board Car",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YBC",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#14161A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Deliberately minimal — this app has two very different shells:
//   1. The phone-app-style shop (Auction/Sale/Account), constrained width
//      + bottom tab nav, defined in app/(shop)/layout.tsx
//   2. Everything else (the standalone /download landing page, /admin),
//      each with their own full-width or custom layout
// Keeping this root layout to just html/body/fonts lets each section look
// like what it actually is, instead of every page being forced into the
// same phone-width app shell.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body bg-asphalt text-ivory min-h-screen antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
