const BUCKET = "car-photos";

/** "https://xxx.supabase.co/storage/v1/object/public/car-photos/auction/abc.jpg" -> "auction/abc.jpg" */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export { BUCKET };
