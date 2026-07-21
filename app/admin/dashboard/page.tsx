"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Plus,
  Trash2,
  EyeOff,
  Eye,
  LogOut,
  Settings as SettingsIcon,
  Inbox,
  Image as ImageIcon,
  Car,
} from "lucide-react";

type Tab = "photos" | "cars" | "offers" | "settings";

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("photos");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await fetch("/api/admin/data");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "photos", label: "Auction ပုံ", icon: ImageIcon },
    { key: "cars", label: "Sale ကား", icon: Car },
    { key: "offers", label: "စျေးများ", icon: Inbox },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen pb-10">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <h1 className="font-display text-2xl tracking-wide text-ivory">
          YBC <span className="text-amber">Admin</span>
        </h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-1.5 text-sm text-chrome"
        >
          <LogOut size={15} /> Logout
        </button>
      </header>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-display tracking-wide ${
              tab === key ? "bg-amber text-asphalt" : "bg-surface2 text-chrome"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      <main className="px-4 py-5">
        {loading || !data ? (
          <p className="text-chrome">Loading…</p>
        ) : tab === "photos" ? (
          <PhotosTab photos={data.photos} cars={data.cars} onChange={refresh} />
        ) : tab === "cars" ? (
          <CarsTab cars={data.cars} onChange={refresh} />
        ) : tab === "offers" ? (
          <OffersTab offers={data.offers} />
        ) : (
          <SettingsTab settings={data.settings} onChange={refresh} />
        )}
      </main>
    </div>
  );
}

/* ---------------- Auction Photos ---------------- */

function PhotosTab({
  photos,
  cars,
  onChange,
}: {
  photos: any[];
  cars: any[];
  onChange: () => void;
}) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [caption, setCaption] = useState("");
  const [carId, setCarId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    fd.append("caption", caption);
    if (carId) fd.append("car_id", carId);

    const res = await fetch("/api/admin/photos", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(json.error);
      return;
    }
    setFiles(null);
    setCaption("");
    onChange();
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    onChange();
  }

  async function remove(id: string) {
    if (!confirm("ဒီပုံကို ဖျက်မှာ သေချာလား?")) return;
    await fetch("/api/admin/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onChange();
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleUpload}
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface p-4"
      >
        <h2 className="font-display text-xl text-ivory">Auction ပုံအသစ်တင်မည်</h2>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(e.target.files)}
          className="text-sm text-chrome file:mr-3 file:rounded-lg file:border-0 file:bg-amber file:px-3 file:py-2 file:text-asphalt"
        />
        <input
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="rounded-xl border border-white/10 bg-surface2 px-4 py-2.5 text-ivory outline-none focus:border-amber"
        />
        <select
          value={carId}
          onChange={(e) => setCarId(e.target.value)}
          className="rounded-xl border border-white/10 bg-surface2 px-4 py-2.5 text-ivory outline-none focus:border-amber"
        >
          <option value="">Sale listing နဲ့ မချိတ်ပါ</option>
          {cars.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={uploading}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber py-3 font-display text-lg text-asphalt disabled:opacity-60"
        >
          <Upload size={18} /> {uploading ? "တင်နေသည်…" : "Upload"}
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3">
        {photos.map((p: any) => (
          <div
            key={p.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-surface"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt="" className="h-32 w-full object-cover" />
            <div className="flex items-center justify-between p-2">
              <button onClick={() => toggleActive(p.id, p.is_active)} title="Toggle visible">
                {p.is_active ? (
                  <Eye size={16} className="text-amber" />
                ) : (
                  <EyeOff size={16} className="text-chrome" />
                )}
              </button>
              <button onClick={() => remove(p.id)}>
                <Trash2 size={16} className="text-ember" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Sale Cars ---------------- */

function CarsTab({ cars, onChange }: { cars: any[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/cars", { method: "POST", body: fd });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error);
      return;
    }
    setOpen(false);
    onChange();
  }

  async function toggleStatus(id: string, status: string) {
    await fetch("/api/admin/cars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: status === "for_sale" ? "sold" : "for_sale",
      }),
    });
    onChange();
  }

  async function remove(id: string) {
    if (!confirm("ဒီကားစာရင်းကို ဖျက်မှာ သေချာလား?")) return;
    await fetch("/api/admin/cars", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onChange();
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center gap-2 rounded-xl bg-amber py-3 font-display text-lg text-asphalt"
      >
        <Plus size={18} /> Sale ကားအသစ်ထည့်မည်
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-surface p-4"
        >
          <input name="title" required placeholder="Title (e.g. Toyota Premio 2015)" className="input" />
          <div className="grid grid-cols-2 gap-2.5">
            <input name="brand" placeholder="Brand" className="input" />
            <input name="model" placeholder="Model" className="input" />
            <input name="year" type="number" placeholder="Year" className="input" />
            <input name="power" placeholder="Power (e.g. 150 hp)" className="input" />
            <input name="price" type="number" placeholder="Price (ကျပ်)" className="input" />
            <input name="mileage" placeholder="Mileage" className="input" />
            <input name="transmission" placeholder="Transmission" className="input" />
            <input name="fuel_type" placeholder="Fuel type" className="input" />
            <input name="color" placeholder="Color" className="input" />
          </div>
          <textarea name="description" placeholder="Description" className="input min-h-20" />
          <label className="text-sm text-chrome">Cover image</label>
          <input type="file" name="cover_image" accept="image/*" className="text-sm text-chrome file:mr-3 file:rounded-lg file:border-0 file:bg-amber file:px-3 file:py-2 file:text-asphalt" />
          {error && <p className="text-sm text-ember">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-1 rounded-xl bg-steel py-3 font-display text-lg text-ivory disabled:opacity-60"
          >
            {saving ? "သိမ်းနေသည်…" : "သိမ်းမည်"}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {cars.map((c: any) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-surface p-3"
          >
            <div>
              <p className="font-display text-lg text-ivory">{c.title}</p>
              <p className="text-xs text-chrome">
                {c.status === "for_sale" ? "For sale" : "Sold"} ·{" "}
                {c.price ? `${Number(c.price).toLocaleString()} ကျပ်` : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleStatus(c.id, c.status)}
                className="rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-chrome"
              >
                {c.status === "for_sale" ? "Mark sold" : "Mark for sale"}
              </button>
              <button onClick={() => remove(c.id)}>
                <Trash2 size={16} className="text-ember" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Offers ---------------- */

function OffersTab({ offers }: { offers: any[] }) {
  if (offers.length === 0) {
    return <p className="text-chrome">"စျေး" ပို့ထားသူ မရှိသေးပါ။</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {offers.map((o: any) => (
        <div key={o.id} className="rounded-xl border border-white/10 bg-surface p-3">
          <p className="font-display text-lg text-amber">{o.offer_price}</p>
          <p className="text-sm text-ivory">Viber: {o.buyer_viber_number}</p>
          <p className="mt-1 truncate text-xs text-chrome">{o.image_url}</p>
          <p className="mt-1 text-xs text-chrome/70">
            {new Date(o.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Settings ---------------- */

function SettingsTab({
  settings,
  onChange,
}: {
  settings: Record<string, string>;
  onChange: () => void;
}) {
  const [viber, setViber] = useState(settings.admin_viber_number ?? "");
  const [telegram, setTelegram] = useState(settings.admin_telegram_username ?? "");
  const [preferred, setPreferred] = useState(settings.preferred_channel ?? "viber");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_viber_number: viber,
        admin_telegram_username: telegram,
        preferred_channel: preferred,
      }),
    });
    setSaving(false);
    onChange();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface p-4">
      <h2 className="font-display text-xl text-ivory">Contact routing</h2>
      <label className="flex flex-col gap-1 text-sm text-chrome">
        Admin Viber number
        <input value={viber} onChange={(e) => setViber(e.target.value)} className="input" placeholder="09xxxxxxxxx" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-chrome">
        Admin Telegram username
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="input" placeholder="ybc_admin" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-chrome">
        Preferred channel for offer messages
        <select value={preferred} onChange={(e) => setPreferred(e.target.value)} className="input">
          <option value="viber">Viber</option>
          <option value="telegram">Telegram</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={saving}
        className="mt-1 rounded-xl bg-amber py-3 font-display text-lg text-asphalt disabled:opacity-60"
      >
        {saving ? "သိမ်းနေသည်…" : "သိမ်းမည်"}
      </button>
    </form>
  );
}
