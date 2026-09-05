import { createFileRoute } from "@tanstack/react-router";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
};

type RawSong = {
  id?: unknown;
  videoId?: unknown;
  title?: unknown;
  artist?: unknown;
  thumbnail?: unknown;
};

/** Cari lagu di endpoint musik, ambil hasil terbaik. */
export async function fetchMusic(query: string): Promise<MusicTrack | null> {
  const res = await fetch(`https://merajah.xyz/music/search?q=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: { songs?: RawSong[]; topResult?: RawSong; videos?: RawSong[] };
  };

  const pools = [data.data?.songs ?? [], data.data?.videos ?? []];
  const top = data.data?.topResult;
  const candidates: RawSong[] = [...pools[0]!, ...pools[1]!];

  const pick = candidates.find((s) => typeof s.id === "string" && s.id) ?? top;
  if (!pick || typeof pick.id !== "string") return null;

  const title = typeof pick.title === "string" ? pick.title : query;
  const rawArtist = typeof pick.artist === "string" ? pick.artist : "";
  // Beberapa hasil mengisi artist sama dengan judul: pakai subtitle/topResult sebagai cadangan.
  const artist =
    rawArtist && rawArtist !== title
      ? rawArtist
      : (() => {
          const sub = typeof (top as { subtitle?: unknown })?.subtitle === "string"
            ? ((top as { subtitle: string }).subtitle)
            : "";
          const parts = sub.split("•").map((p) => p.trim());
          return parts[1] || "Unknown artist";
        })();

  return {
    id: pick.id,
    title,
    artist,
    thumbnail: typeof pick.thumbnail === "string" ? pick.thumbnail : "",
  };
}

export const Route = createFileRoute("/api/music")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.trim();
        if (!q) return Response.json({ error: "Query kosong." }, { status: 400 });
        try {
          const track = await fetchMusic(q);
          if (!track) return Response.json({ track: null }, { status: 200 });
          return Response.json(
            { track },
            { headers: { "Cache-Control": "public, max-age=600" } },
          );
        } catch {
          return Response.json({ track: null }, { status: 200 });
        }
      },
    },
  },
});
