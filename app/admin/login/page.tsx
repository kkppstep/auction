"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Login failed.");
      return;
    }
    router.push("/admin/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="gauge-ring flex h-14 w-14 items-center justify-center rounded-full bg-amber/10 text-amber">
          <Lock size={24} />
        </span>
        <h1 className="font-display text-3xl tracking-wide text-ivory">
          YBC Admin
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          required
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-xl border border-white/10 bg-surface2 px-4 py-3 text-ivory outline-none focus:border-amber"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-white/10 bg-surface2 px-4 py-3 text-ivory outline-none focus:border-amber"
        />
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-amber py-3 font-display text-lg tracking-wide text-asphalt disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
