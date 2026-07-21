import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("key, value");
  const map = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]));

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-3xl tracking-wide text-ivory">
        YBC <span className="text-amber">Account</span>
      </h1>

      <section className="mt-6 rounded-2xl border border-white/10 bg-surface p-4">
        <h2 className="font-display text-xl tracking-wide text-ivory">
          ဆက်သွယ်ရန်
        </h2>
        <p className="mt-1 text-sm text-chrome">
          Auction ကားများနှင့် ပတ်သက်၍ တိုက်ရိုက်ဆက်သွယ်လိုပါက
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {map.admin_viber_number && (
            <a
              href={`viber://chat?number=${encodeURIComponent(
                map.admin_viber_number
              )}`}
              className="rounded-xl bg-surface2 px-4 py-3 text-center font-display tracking-wide text-amber"
            >
              Viber တွင် ဆက်သွယ်မည်
            </a>
          )}
          {map.admin_telegram_username && (
            <a
              href={`https://t.me/${map.admin_telegram_username}`}
              target="_blank"
              className="rounded-xl bg-surface2 px-4 py-3 text-center font-display tracking-wide text-steel2"
            >
              Telegram တွင် ဆက်သွယ်မည်
            </a>
          )}
        </div>
      </section>

      <p className="mt-10 text-center">
        <Link href="/admin/login" className="text-xs text-chrome/60 underline">
          Admin login
        </Link>
      </p>
    </div>
  );
}
