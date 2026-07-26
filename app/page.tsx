"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  Gavel,
  Truck,
  ShieldCheck,
  Tag,
  SlidersHorizontal,
  Gift,
  Download as DownloadIcon,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

const WHAT_WE_DO = [
  { icon: Eye, text: "လေလံကားများကို စိတ်ကြိုက် ကြည့်ရှုပေးခြင်း" },
  { icon: Gavel, text: "ကိုယ်တိုင် လေလံ စွဲသည့်အလား စိတ်ပါဝင်စားစွာ လုပ်ပေးခြင်း" },
  { icon: Truck, text: "နယ်အရောက် ပို့ပေးခြင်း" },
];

const WHY_OUR_CARS = [
  { icon: ShieldCheck, text: "ဂျင်းကားများ မဟုတ်ခြင်း" },
  { icon: Tag, text: "မော်ဒယ်မြင့် စျေးနှုန်း သက်သာခြင်း" },
  { icon: SlidersHorizontal, text: "ကိုယ်တိုင် စိတ်ကြိုက် ရွေးချယ်နိုင်ခြင်း" },
  { icon: Gift, text: "ကြိုက်ပွိုင့်ဖြင့် မှာယူနိုင်ခြင်း" },
];

export default function HomePage() {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabaseBrowser.from("settings").select("key, value");
      const map = Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));
      if (active) {
        setLinks(map);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-asphalt">
      {/* simple standalone header — no app nav, no phone-width constraint */}
      <header className="border-b border-white/5 px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-display text-xl tracking-wide text-ivory">
            YBC <span className="text-amber">Your Board Car</span>
          </Link>
          <Link
            href="/auction"
            className="text-sm text-chrome underline decoration-dotted underline-offset-4"
          >
            Web ဖြင့် ကြည့်ရှုမည်
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/icons/icon-192.png"
            alt="YBC"
            width={88}
            height={88}
            className="gauge-ring rounded-3xl"
          />
          <h1 className="mt-6 font-display text-5xl tracking-wide text-ivory sm:text-6xl">
            YBC <span className="text-amber">Your Board Car</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-chrome sm:text-lg">
            မြန်မာနိုင်ငံသား များအတွက် စိတ်ချရသော ကားလေလံ Application
          </p>
        </div>

        {/* What we do */}
        <section className="mt-16">
          <h2 className="text-center font-display text-2xl tracking-wide text-ivory">
            YBC ဘာလုပ်ပေးလဲ
          </h2>
          <div className="mx-auto mt-6 grid max-w-2xl gap-4 sm:grid-cols-3">
            {WHAT_WE_DO.map(({ icon: Icon, text }, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-surface p-6 text-center"
              >
                <span className="gauge-ring flex h-12 w-12 items-center justify-center rounded-full bg-amber/10 text-amber">
                  <Icon size={20} />
                </span>
                <p className="text-sm text-ivory">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why our cars */}
        <section className="mt-14">
          <h2 className="text-center font-display text-2xl tracking-wide text-ivory">
            လေလံကားများ အားသာချက်
          </h2>
          <div className="mx-auto mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
            {WHY_OUR_CARS.map(({ icon: Icon, text }, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-surface p-5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-steel/15 text-steel2">
                  <Icon size={18} />
                </span>
                <p className="text-sm text-ivory">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Download */}
        <section className="mt-16 flex flex-col items-center">
          <h2 className="font-display text-2xl tracking-wide text-ivory">
            App ကို ဒေါင်းလုဒ်ဆွဲမည်
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-chrome">တင်နေသည်…</p>
          ) : (
            <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
              <DownloadButton
                label="APKPure မှ ဒေါင်းလုဒ်ဆွဲမည်"
                url={links.apkpure_url}
                accent="amber"
              />
              <DownloadButton label="Google Play" url={links.google_play_url} accent="steel" />
              <DownloadButton
                label="App Store (မကြာမီ)"
                url={links.app_store_url}
                accent="surface2"
              />
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-chrome/60">
        © {new Date().getFullYear()} YBC — Your Board Car
      </footer>
    </div>
  );
}

function DownloadButton({
  label,
  url,
  accent,
}: {
  label: string;
  url?: string;
  accent: "amber" | "steel" | "surface2";
}) {
  const styles = {
    amber: "bg-amber text-asphalt",
    steel: "bg-steel text-ivory",
    surface2: "bg-surface2 text-chrome",
  }[accent];

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl py-3.5 font-display text-lg tracking-wide opacity-50 ${styles}`}
      >
        <DownloadIcon size={18} /> {label} — မကြာမီ
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-center gap-2 rounded-xl py-3.5 font-display text-lg tracking-wide ${styles}`}
    >
      <DownloadIcon size={18} /> {label}
    </a>
  );
}
