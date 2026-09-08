import { memo, useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { MusicTrack } from "@/routes/api/music";

const cache = new Map<string, MusicTrack | "empty">();
const pending = new Map<string, Promise<MusicTrack | "empty">>();

/** Ambil data lagu (dipakai juga untuk pramuat sebelum jawaban ditampilkan). */
export function prefetchMusic(query: string): Promise<MusicTrack | "empty"> {
  const cached = cache.get(query);
  if (cached) return Promise.resolve(cached);
  const hit = pending.get(query);
  if (hit) return hit;
  const task = (async () => {
    try {
      const res = await fetch(`/api/music?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { track?: MusicTrack | null };
      if (data.track && data.track.id) return data.track;
    } catch {
      // Lanjut ke percobaan langsung dari browser.
    }
    try {
      const res = await fetch(
        `https://merajah.xyz/music/search?q=${encodeURIComponent(query)}`,
      );
      const raw = (await res.json()) as {
        data?: { songs?: Array<Partial<MusicTrack> & { id?: string }> };
      };
      const first = raw.data?.songs?.find((s) => s.id);
      if (first?.id) {
        return {
          id: first.id,
          title: first.title ?? query,
          artist: first.artist ?? "",
          thumbnail: first.thumbnail ?? "",
        };
      }
    } catch {
      // Tidak ada hasil.
    }
    return "empty" as const;
  })().then((value) => {
    cache.set(query, value);
    pending.delete(query);
    return value;
  });
  pending.set(query, task);
  return task;
}

/** Hanya satu pemutar aktif: pemutar lain otomatis dijeda. */
let activeStop: (() => void) | null = null;

export function claimPlayback(stop: () => void) {
  if (activeStop && activeStop !== stop) activeStop();
  activeStop = stop;
}

export function releasePlayback(stop: () => void) {
  if (activeStop === stop) activeStop = null;
}

/** Indikator gelombang saat lagu diputar. */
export function PlayingBars() {
  return (
    <span className="music-bars" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}


function MusicCardBase({ query }: { query: string }) {
  const [track, setTrack] = useState<MusicTrack | "empty" | null>(cache.get(query) ?? null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const stopStable = useRef<() => void>(() => stopRef.current());

  const command = (func: "playVideo" | "pauseVideo") => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*",
    );
  };

  stopRef.current = () => {
    command("pauseVideo");
    setPlaying(false);
  };

  useEffect(() => {
    const stop = stopStable.current;
    return () => releasePlayback(stop);
  }, []);

  useEffect(() => {
    let disposed = false;
    const cached = cache.get(query);
    if (cached) {
      setTrack(cached);
      return;
    }
    setTrack(null);
    void prefetchMusic(query).then((value) => {
      if (!disposed) setTrack(value);
    });
    return () => {
      disposed = true;
    };
  }, [query]);

  if (track === null || track === "empty") return null;

  const toggle = () => {
    if (!started) {
      claimPlayback(stopStable.current);
      setStarted(true);
      setPlaying(true);
      return;
    }
    if (playing) {
      command("pauseVideo");
      setPlaying(false);
      releasePlayback(stopStable.current);
    } else {
      claimPlayback(stopStable.current);
      command("playVideo");
      setPlaying(true);
    }
  };


  return (
    <span className="music-block">
      <span className="music-card">
        {track.thumbnail ? (
          <img className="music-art" src={track.thumbnail} alt={track.title} loading="lazy" />
        ) : (
          <span className="music-art music-art-empty" />
        )}
        <span className="music-info">
          <span className="music-title-row">
            {playing && <PlayingBars />}
            <span className="music-title">{track.title}</span>
          </span>
          <span className="music-artist">{track.artist}</span>
        </span>
        <button
          type="button"
          className="music-toggle"
          aria-label={playing ? "Pause" : "Play"}
          onClick={toggle}
        >
          {playing ? (
            <Pause size={18} strokeWidth={2.2} fill="currentColor" />
          ) : (
            <Play size={18} strokeWidth={2.2} fill="currentColor" />
          )}
        </button>
        {started && (
          <iframe
            ref={frameRef}
            title={track.title}
            src={`https://www.youtube.com/embed/${track.id}?autoplay=1&enablejsapi=1&playsinline=1&controls=0`}
            allow="autoplay; encrypted-media"
            className="music-hidden-player"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
      </span>
    </span>
  );
}

export const MusicCard = memo(MusicCardBase);

export default MusicCard;
