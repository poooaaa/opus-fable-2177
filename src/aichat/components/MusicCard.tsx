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
      return data.track && data.track.id ? data.track : ("empty" as const);
    } catch {
      return "empty" as const;
    }
  })().then((value) => {
    cache.set(query, value);
    pending.delete(query);
    return value;
  });
  pending.set(query, task);
  return task;
}

/** Indikator gelombang saat lagu diputar. */
function PlayingBars() {
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  if (track === null || track === "empty") return null;

  const toggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(`https://merajah.xyz/music/download?id=${track.id}`);
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      audio.onplay = () => setPlaying(true);
      audioRef.current = audio;
    }
    if (playing) audioRef.current.pause();
    else void audioRef.current.play().catch(() => setPlaying(false));
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
      </span>
    </span>
  );
}

export const MusicCard = memo(MusicCardBase);

export default MusicCard;
