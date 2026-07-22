import Link from "next/link";

export default function AccountPage() {
  const viberNumber = "+959782020819";
  const telegramUsername = "doublepz";

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
          <a
            href={`viber://chat?number=${encodeURIComponent(viberNumber)}`}
            className="rounded-xl bg-surface2 px-4 py-3 text-center font-display tracking-wide text-amber"
          >
            Viber တွင် ဆက်သွယ်မည်
          </a>

          <a
            href={`https://t.me/${telegramUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-surface2 px-4 py-3 text-center font-display tracking-wide text-steel2"
          >
            Telegram တွင် ဆက်သွယ်မည်
          </a>
        </div>
      </section>
    </div>
  );
}
