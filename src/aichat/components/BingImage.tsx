import { useEffect, useState } from "react";

type ImageItem = { url: string; title: string };

/** Gambar hasil pencarian Bing, dipakai lewat sintaks [bimg={query}]. */
export function BingImage({ query }: { query: string }) {
  const [items, setItems] = useState<ImageItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    setItems(null);
    setIndex(0);
    setFailed(false);

    void (async () => {
      try {
        const res = await fetch(`/api/bingimg?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { images?: ImageItem[] };
        if (disposed) return;
        setItems(data.images ?? []);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

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
        <span className="chat-media-skeleton" />
      )}
    </span>
  );
}

export default BingImage;
