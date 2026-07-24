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

type Tab = "posts" | "cars" | "offers" | "settings";

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("posts");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);

  function showToast(text: string, kind: "ok" | "error" = "ok") {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2800);
  }

  async function refresh() {
    try {
      const res = await fetch("/api/admin/data", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load dashboard data (${res.status}).`);
      const json = await res.json();
      setData(json);
      setRefreshError(null);
    } catch (err: any) {
      // This is the failure mode that used to look like "delete does
      // nothing" — the action succeeded but the list never reloaded.
      // Now it's visible instead of silent.
      setRefreshError(err?.message ?? "Failed to refresh dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "posts", label: "Auction ပို့စ်", icon: ImageIcon },
    { key: "cars", label: "Sale ကား", icon: Car },
    { key: "offers", label: "စျေးများ", icon: Inbox },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen pb-10">

      {toast && (
        <div
          className={`fixed left-1/2 top-3 z-[70] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-display tracking-wide shadow-lg ${
            toast.kind === "ok" ? "bg-amber text-asphalt" : "bg-ember text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

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
        {refreshError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-ember">
            <span>{refreshError}</span>
            <button onClick={refresh} className="shrink-0 rounded-lg bg-ember/20 px-2.5 py-1">
              ပြန်ကြိုးစားမည်
            </button>
          </div>
        )}
        {loading || !data ? (
          <p className="text-chrome">Loading…</p>
        ) : tab === "posts" ? (
          <PostsTab posts={data.posts} cars={data.cars} onChange={refresh} showToast={showToast} />
        ) : tab === "cars" ? (
          <CarsTab cars={data.cars} onChange={refresh} showToast={showToast} />
        ) : tab === "offers" ? (
          <OffersTab offers={data.offers} />
        ) : (
          <>
            <SettingsTab settings={data.settings} onChange={refresh} showToast={showToast} />
            <PushTestPanel showToast={showToast} />
          </>
        )}
      </main>
    </div>
  );
}

async function checkOk(res: Response) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* body wasn't JSON — keep the generic message */
    }
    throw new Error(message);
  }
  return res;
}

/* ---------------- Auction Posts ---------------- */

function PostsTab({
  posts,
  cars,
  onChange,
  showToast,
}: {
  posts: any[];
  cars: any[];
  onChange: () => Promise<void>;
  showToast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [caption, setCaption] = useState("");
  const [carId, setCarId] = useState("");
  const [sendPush, setSendPush] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadPreview, setUploadPreview] = useState<{ caption: string; photos: any[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      // 1. Create the post first (caption + linked car, no files yet).
      const postRes = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, car_id: carId || null }),
      });
      const postJson = await postRes.json();
      if (!postRes.ok) throw new Error(postJson.error);
      const postId = postJson.post.id;

      // 2. Upload photos into that post with a few running concurrently
      // (fast, and still safely below Vercel's per-request limits since
      // each request only ever carries one photo) — and show each one
      // in a live preview as it lands, instead of a blank wait until the
      // whole batch finishes.
      const fileArray = Array.from(files);
      setProgress({ done: 0, total: fileArray.length });
      setUploadPreview({ caption, photos: [] });

      const CONCURRENCY = 4;
      let nextIndex = 0;
      let uploadError: string | null = null;

      async function worker() {
        while (nextIndex < fileArray.length && !uploadError) {
          const i = nextIndex++;
          const fd = new FormData();
          fd.append("file", fileArray[i]);
          const res = await fetch(`/api/admin/posts/${postId}/photos`, {
            method: "POST",
            body: fd,
          });
          if (!res.ok) {
            const json = await res.json();
            uploadError = `Photo ${i + 1}/${fileArray.length}: ${json.error}`;
            return;
          }
          const json = await res.json();
          setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
          setUploadPreview((prev) =>
            prev ? { ...prev, photos: [...prev.photos, json.photo] } : prev
          );
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
      if (uploadError) throw new Error(uploadError);

      setFiles(null);
      setCaption("");
      setCarId("");

      if (sendPush) {
        try {
          const notifyRes = await fetch(`/api/admin/posts/${postId}/notify`, {
            method: "POST",
          });
          const notifyJson = await notifyRes.json();
          const push = notifyJson.push;
          if (!push?.configured) {
            showToast("Post တင်ပြီးပါပြီ — Push notification setup လိုအပ်နေသေးပါသည်", "error");
          } else if (push.targeted === 0) {
            showToast("Post တင်ပြီးပါပြီ — Push လက်ခံမည့် app user မရှိသေးပါ", "error");
          } else if (push.sent > 0) {
            showToast(`Post တင်ပြီးပါပြီ — Push ${push.sent}/${push.targeted} ကို ပို့ပြီးပါပြီ`);
          } else {
            showToast("Post တင်ပြီးပါပြီ — Push ပို့၍မရပါ (device token expired?)", "error");
          }
        } catch {
          showToast("Post တင်ပြီးပါပြီ — Push ပို့ရာတွင် error ဖြစ်သည်", "error");
        }
      } else {
        showToast("Post တင်ပြီးပါပြီ");
      }

      await onChange();
    } catch (err: any) {
      setError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(null);
      setUploadPreview(null);
    }
  }

  async function toggleActive(id: string, is_active: boolean) {
    try {
      await checkOk(
        await fetch("/api/admin/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, is_active: !is_active }),
        })
      );
      showToast(is_active ? "ဝှက်လိုက်ပါပြီ" : "ပြသနေပါပြီ");
      await onChange();
    } catch (err: any) {
      showToast(err.message ?? "Failed to update post visibility.", "error");
    }
  }

  async function saveCaption(id: string) {
    try {
      await checkOk(
        await fetch("/api/admin/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, caption: editCaption }),
        })
      );
      setEditingId(null);
      showToast("Caption ပြောင်းပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      showToast(err.message ?? "Failed to save caption.", "error");
    }
  }

  async function removePost(id: string) {
    if (!confirm("ဒီ post တစ်ခုလုံးကို ဖျက်မှာ သေချာလား? ပုံအားလုံးပါ ပျက်သွားပါမည်။")) return;
    try {
      await checkOk(
        await fetch("/api/admin/posts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
      );
      showToast("Post ဖျက်ပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      showToast(err.message ?? "Failed to delete post.", "error");
    }
  }

  async function removePhoto(postId: string, photoId: string) {
    try {
      await checkOk(
        await fetch(`/api/admin/posts/${postId}/photos`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId }),
        })
      );
      showToast("ပုံဖျက်ပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      showToast(err.message ?? "Failed to delete photo.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleUpload}
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface p-4"
      >
        <h2 className="font-display text-xl text-ivory">Post အသစ်တင်မည် (ပုံ 50+ ရနိုင်)</h2>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(e.target.files)}
          className="text-sm text-chrome file:mr-3 file:rounded-lg file:border-0 file:bg-amber file:px-3 file:py-2 file:text-asphalt"
        />
        {files && (
          <p className="text-xs text-chrome">{files.length} ပုံ ရွေးထားသည်</p>
        )}
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
        {progress && (
          <div className="flex flex-col gap-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full bg-amber transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-chrome">
              {progress.done} / {progress.total} ပုံ တင်ပြီးပါပြီ
            </p>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-chrome">
          <input
            type="checkbox"
            checked={sendPush}
            onChange={(e) => setSendPush(e.target.checked)}
            className="h-4 w-4 accent-amber"
          />
          Post တင်ပြီးရင် app user များကို Push notification ပို့မည်
        </label>
        <button
          type="submit"
          disabled={uploading}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber py-3 font-display text-lg text-asphalt disabled:opacity-60"
        >
          <Upload size={18} /> {uploading ? "တင်နေသည်…" : "Post အသစ်တင်မည်"}
        </button>
      </form>

      {uploadPreview && uploadPreview.photos.length > 0 && (
        <div className="rounded-2xl border border-amber/30 bg-surface p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber" />
            <p className="text-xs text-chrome">
              တင်နေဆဲ — {uploadPreview.photos.length} ပုံ ပြီးပြီ
            </p>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {uploadPreview.photos.map((p: any) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.image_url}
                alt=""
                className="h-24 w-24 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {posts.map((post: any) => (
          <div
            key={post.id}
            className="rounded-2xl border border-white/10 bg-surface p-3"
          >
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
              {post.auction_photos.map((p: any) => (
                <div key={p.id} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => removePhoto(post.id, p.id)}
                    className="absolute -right-1 -top-1 rounded-full bg-asphalt p-1"
                    title="ဒီပုံတစ်ပုံတည်း ဖျက်မည်"
                  >
                    <Trash2 size={12} className="text-ember" />
                  </button>
                </div>
              ))}
            </div>

            {editingId === post.id ? (
              <div className="flex gap-2">
                <input
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="input"
                  autoFocus
                />
                <button
                  onClick={() => saveCaption(post.id)}
                  className="shrink-0 rounded-lg bg-amber px-3 text-sm text-asphalt"
                >
                  သိမ်းမည်
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingId(post.id);
                  setEditCaption(post.caption ?? "");
                }}
                className="text-left text-sm text-ivory underline decoration-dotted"
              >
                {post.caption || "Caption ထည့်ရန် နှိပ်ပါ"}
              </button>
            )}

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-chrome">
                {post.auction_photos.length} ပုံ
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleActive(post.id, post.is_active)} title="Toggle visible">
                  {post.is_active ? (
                    <Eye size={16} className="text-amber" />
                  ) : (
                    <EyeOff size={16} className="text-chrome" />
                  )}
                </button>
                <button onClick={() => removePost(post.id)}>
                  <Trash2 size={16} className="text-ember" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Sale Cars ---------------- */

function CarsTab({
  cars,
  onChange,
  showToast,
}: {
  cars: any[];
  onChange: () => Promise<void>;
  showToast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      await checkOk(await fetch("/api/admin/cars", { method: "POST", body: fd }));
      setOpen(false);
      showToast("Sale ကားအသစ် ထည့်ပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      setError(err.message ?? "Failed to save listing.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      fd.append("id", editingCar.id);
      await checkOk(await fetch("/api/admin/cars", { method: "PATCH", body: fd }));
      setEditingCar(null);
      showToast("ကားအချက်အလက် ပြင်ဆင်ပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      setError(err.message ?? "Failed to update listing.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string, status: string) {
    try {
      await checkOk(
        await fetch("/api/admin/cars", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            status: status === "for_sale" ? "sold" : "for_sale",
          }),
        })
      );
      showToast(status === "for_sale" ? "ရောင်းပြီးအဖြစ် သတ်မှတ်ပြီးပါပြီ" : "ရောင်းရန် ပြန်ထားပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      showToast(err.message ?? "Failed to update status.", "error");
    }
  }

  async function remove(id: string) {
    if (!confirm("ဒီကားစာရင်းကို ဖျက်မှာ သေချာလား?")) return;
    try {
      await checkOk(
        await fetch("/api/admin/cars", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
      );
      showToast("ကားစာရင်း ဖျက်ပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      showToast(err.message ?? "Failed to delete listing.", "error");
    }
  }

  const fields: [string, string, string?][] = [
    ["brand", "Brand"],
    ["model", "Model"],
    ["year", "Year", "number"],
    ["power", "Power (e.g. 150 hp)"],
    ["price", "Price (ကျပ်)", "number"],
    ["mileage", "Mileage"],
    ["transmission", "Transmission"],
    ["fuel_type", "Fuel type"],
    ["color", "Color"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setEditingCar(null);
        }}
        className="flex items-center justify-center gap-2 rounded-xl bg-amber py-3 font-display text-lg text-asphalt"
      >
        <Plus size={18} /> Sale ကားအသစ်ထည့်မည်
      </button>

      {open && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-surface p-4"
        >
          <input name="title" required placeholder="Title (e.g. Toyota Premio 2015)" className="input" />
          <div className="grid grid-cols-2 gap-2.5">
            {fields.map(([name, placeholder, type]) => (
              <input key={name} name={name} type={type ?? "text"} placeholder={placeholder} className="input" />
            ))}
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
        {cars.map((c: any) =>
          editingCar?.id === c.id ? (
            <form
              key={c.id}
              onSubmit={handleEditSave}
              className="flex flex-col gap-2.5 rounded-2xl border border-amber/40 bg-surface p-4"
            >
              <input name="title" required defaultValue={c.title} placeholder="Title" className="input" />
              <div className="grid grid-cols-2 gap-2.5">
                {fields.map(([name, placeholder, type]) => (
                  <input
                    key={name}
                    name={name}
                    type={type ?? "text"}
                    defaultValue={c[name] ?? ""}
                    placeholder={placeholder}
                    className="input"
                  />
                ))}
              </div>
              <textarea
                name="description"
                defaultValue={c.description ?? ""}
                placeholder="Description"
                className="input min-h-20"
              />
              <label className="text-sm text-chrome">
                Replace cover image (leave empty to keep current)
              </label>
              <input
                type="file"
                name="cover_image"
                accept="image/*"
                className="text-sm text-chrome file:mr-3 file:rounded-lg file:border-0 file:bg-amber file:px-3 file:py-2 file:text-asphalt"
              />
              {error && <p className="text-sm text-ember">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-amber py-3 font-display text-lg text-asphalt disabled:opacity-60"
                >
                  {saving ? "သိမ်းနေသည်…" : "ပြောင်းလဲမှု သိမ်းမည်"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCar(null);
                    setError(null);
                  }}
                  className="rounded-xl bg-surface2 px-4 text-ivory"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-surface p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg text-ivory">{c.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-display tracking-wide ${
                      c.status === "for_sale"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/10 text-chrome"
                    }`}
                  >
                    {c.status === "for_sale" ? "ရောင်းရန်" : "ရောင်းပြီး"}
                  </span>
                </div>
                <p className="text-xs text-chrome">
                  {c.price ? `${Number(c.price).toLocaleString()} ကျပ်` : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditingCar(c);
                    setOpen(false);
                    setError(null);
                  }}
                  className="rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-chrome"
                >
                  Edit
                </button>
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
          )
        )}
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
  showToast,
}: {
  settings: Record<string, string>;
  onChange: () => Promise<void>;
  showToast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [viber, setViber] = useState(settings.admin_viber_number ?? "");
  const [phone, setPhone] = useState(settings.admin_phone_number ?? "");
  const [telegram, setTelegram] = useState(settings.admin_telegram_username ?? "");
  const [preferred, setPreferred] = useState(settings.preferred_channel ?? "viber");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await checkOk(
        await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admin_viber_number: viber,
            admin_phone_number: phone,
            admin_telegram_username: telegram,
            preferred_channel: preferred,
          }),
        })
      );
      showToast("Settings သိမ်းပြီးပါပြီ");
      await onChange();
    } catch (err: any) {
      showToast(err.message ?? "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface p-4">
      <h2 className="font-display text-xl text-ivory">Contact routing</h2>
      <label className="flex flex-col gap-1 text-sm text-chrome">
        Admin Viber number (country code, no + or leading 0 — e.g. 959782020819)
        <input value={viber} onChange={(e) => setViber(e.target.value)} className="input" placeholder="959782020819" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-chrome">
        Admin phone number (for the buyer's "Call" button)
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+66943329162" />
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

function PushTestPanel({
  showToast,
}: {
  showToast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [testing, setTesting] = useState(false);

  async function sendTestPush() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/test-push", { method: "POST" });
      const json = await res.json();
      const push = json.push;
      if (!push?.configured) {
        showToast("Push notification setup လိုအပ်နေသေးပါသည် (Firebase)", "error");
      } else if (push.targeted === 0) {
        showToast("Push လက်ခံမည့် app user မရှိသေးပါ — device တစ်ခုမှ register မဖြစ်သေးပါ", "error");
      } else if (push.sent > 0) {
        showToast(`Test push ${push.sent}/${push.targeted} device ကို ပို့ပြီးပါပြီ`);
      } else {
        showToast("Push ပို့၍မရပါ — device token expired သို့မဟုတ် error ဖြစ်နေသည်", "error");
      }
    } catch (err: any) {
      showToast(err.message ?? "Test push failed.", "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-surface p-4">
      <h2 className="font-display text-xl text-ivory">Push notification test</h2>
      <p className="mt-1 text-sm text-chrome">
        Post တစ်ခု အသစ်တင်စရာမလိုပဲ push pipeline အလုပ်လုပ်မလုပ် စစ်ဆေးနိုင်ပါသည်။
      </p>
      <button
        onClick={sendTestPush}
        disabled={testing}
        className="mt-3 w-full rounded-xl bg-steel py-3 font-display text-lg text-ivory disabled:opacity-60"
      >
        {testing ? "ပို့နေသည်…" : "Test push ပို့မည်"}
      </button>
    </div>
  );
}
