/**
 * Accepts whatever admin pastes — a full watch URL, a youtu.be short link,
 * a /live/ link, an /embed/ link, or a bare video ID — and normalizes it
 * down to just the clean 11-character video ID for storage. Storing the
 * clean ID (not the raw URL) keeps the buyer-facing embed code simple.
 */
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1) || null;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/live/")) return url.pathname.split("/")[2] ?? null;
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}
