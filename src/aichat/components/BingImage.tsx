import { memo, useEffect, useState } from "react";

type ImageItem = { url: string; title: string };

/** Cache global: hasil pencarian tidak diambil ulang saat komponen dirender ulang. */
const imageCache = new Map<string, ImageItem[]>();
const imagePending = new Map<string, Promise<ImageItem[]>>();

/** Ukur rasio gambar supaya hasil yang dipilih konsisten (tidak jomplang). */
function measure(url: string) {
  return new Promise<number | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
    img.onerror = () => resolve(null);
    img.referrerPolicy = "no-referrer";
    img.src = url;
    setTimeout(() => resolve(null), 6000);
  });
}

const TARGET = 4 / 3;
const MAX_DEV = 0.3; // toleransi selisih rasio sebelum pindah ke Google Image

/** Ambil kandidat dari satu endpoint lalu urutkan berdasarkan kedekatan rasio. */
async function rank(endpoint: string) {
  const res = await fetch(endpoint);
  const data = (await res.json()) as { images?: ImageItem[] };
  const all = data.images ?? [];
  if (all.length === 0) return { ordered: [] as ImageItem[], best: Infinity };

  const candidates = all.slice(0, 8);
  const ratios = await Promise.all(candidates.map((it) => measure(it.url)));
  const valid = candidates
    .map((it, i) => ({ it, r: ratios[i] }))
    .filter((x): x is { it: ImageItem; r: number } => typeof x.r === "number" && x.r > 0);

  if (valid.length === 0) return { ordered: all, best: Infinity };

  valid.sort((a, b) => Math.abs(Math.log(a.r / TARGET)) - Math.abs(Math.log(b.r / TARGET)));
  const rest = all.filter((it) => !valid.some((v) => v.it.url === it.url));
  const bestEntry = valid[0]!;
  return {
    ordered: [...valid.map((v) => v.it), ...rest],
    best: Math.abs(Math.log(bestEntry.r / TARGET)),
  };
}

/** Muat & pilih gambar terbaik; dipakai juga untuk pramuat sebelum jawaban tampil. */
export function prefetchImage(query: string): Promise<ImageItem[]> {
  const cached = imageCache.get(query);
  if (cached) return Promise.resolve(cached);
  const hit = imagePending.get(query);
  if (hit) return hit;

  const task = (async () => {
    try {
      const primary = await rank(`/api/bingimg?q=${encodeURIComponent(query)}`);
      let chosen = primary;
      if (primary.best > MAX_DEV) {
        try {
          const fallback = await rank(`/api/gimg?q=${encodeURIComponent(query)}`);
          if (fallback.ordered.length > 0 && fallback.best < primary.best) chosen = fallback;
        } catch {
          // Cadangan gagal: tetap pakai hasil terdekat dari Bing.
        }
      }
      return chosen.ordered;
    } catch {
      return [] as ImageItem[];
    }
  })().then((value) => {
    imageCache.set(query, value);
    imagePending.delete(query);
    return value;
  });
  imagePending.set(query, task);
  return task;
}

/** Gambar hasil pencarian Bing, dipakai lewat sintaks [bimg={query}]. */
function BingImageBase({ query }: { query: string }) {
  const cached = imageCache.get(query) ?? null;
  const [items, setItems] = useState<ImageItem[] | null>(cached);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    setIndex(0);
    setFailed(false);
    const hit = imageCache.get(query);
    if (hit) {
      setItems(hit);
      return;
    }
    setItems(null);
    void prefetchImage(query).then((value) => {
      if (!disposed) setItems(value);
    });
    return () => {
      disposed = true;
    };
  }, [query]);

  if (failed || (items && items.length === 0)) {
    return (
      <span className="chat-media-caption text-[12.5px] text-[#8a8a93]">
        Gambar “{query}” tidak ditemukan
      </span>
    );
  }

  const current = items?.[index];

  return (
    <span className="chat-media-figure">
      {current ? (
        <img
          src={current.url}
          alt={current.title || query}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="chat-media-img"
          onError={() => {
            if (items && index + 1 < items.length) setIndex(index + 1);
            else setFailed(true);
          }}
        />
      ) : (
        <span className="chat-media-loading">
          <span className="chat-media-spinner" />
        </span>

      )}
    </span>
  );
}

export const BingImage = memo(BingImageBase);

export default BingImage;
