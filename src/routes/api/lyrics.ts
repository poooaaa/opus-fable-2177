import { createFileRoute } from "@tanstack/react-router";

export type LyricLine = { timeSec: number; text: string };
export type LyricsData = {
  trackName: string;
  artistName: string;
  duration: number;
  lines: LyricLine[];
};

type RawLine = { timeSec?: unknown; timeMs?: unknown; text?: unknown };

/** Ambil lirik tersinkron dari layanan musik. */
export async function fetchLyrics(
  title: string,
  artist: string,
  duration: number,
): Promise<LyricsData | null> {
  const url = `https://merajah.xyz/music/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${duration}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    },
  });
  if (!res.ok) return null;
  const raw = (await res.json()) as {
    data?: {
      trackName?: unknown;
      artistName?: unknown;
      duration?: unknown;
      lines?: RawLine[];
    };
  };
  const data = raw.data;
  if (!data || !Array.isArray(data.lines)) return null;
  const lines: LyricLine[] = data.lines
    .map((l) => ({
      timeSec:
        typeof l.timeSec === "number"
          ? l.timeSec
          : typeof l.timeMs === "number"
            ? l.timeMs / 1000
            : -1,
      text: typeof l.text === "string" ? l.text.trim() : "",
    }))
    .filter((l) => l.timeSec >= 0);
  if (!lines.length) return null;
  return {
    trackName: typeof data.trackName === "string" ? data.trackName : title,
    artistName: typeof data.artistName === "string" ? data.artistName : artist,
    duration: typeof data.duration === "number" ? data.duration : duration,
    lines,
  };
}

export const Route = createFileRoute("/api/lyrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const title = url.searchParams.get("title")?.trim();
        const artist = url.searchParams.get("artist")?.trim() ?? "";
        const duration = Number(url.searchParams.get("duration")) || 210;
        if (!title) return Response.json({ error: "Judul kosong." }, { status: 400 });
        try {
          const lyrics = await fetchLyrics(title, artist, duration);
          return Response.json(
            { lyrics: lyrics ?? null },
            { headers: { "Cache-Control": "public, max-age=600" } },
          );
        } catch {
          return Response.json({ lyrics: null }, { status: 200 });
        }
      },
    },
  },
});
