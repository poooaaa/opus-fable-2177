import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ListMusic, X } from "lucide-react";
import type { MusicTrack } from "@/routes/api/music";
import type { LyricsData } from "@/routes/api/lyrics";
import { claimPlayback, prefetchMusic, releasePlayback, PlayingBars } from "./MusicCard";

const lyricsCache = new Map<string, LyricsData | "empty">();

async function loadLyrics(track: MusicTrack): Promise<LyricsData | "empty"> {
  const key = `${track.title}|${track.artist}`;
  const cached = lyricsCache.get(key);
  if (cached) return cached;
  const params = `title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&duration=210`;
  let value: LyricsData | "empty" = "empty";
  try {
    const res = await fetch(`/api/lyrics?${params}`);
    const data = (await res.json()) as { lyrics?: LyricsData | null };
    if (data.lyrics?.lines?.length) value = data.lyrics;
  } catch {
    // Coba langsung dari browser.
  }
  if (value === "empty") {
    try {
      const res = await fetch(`https://merajah.xyz/music/lyrics?${params}`);
      const raw = (await res.json()) as {
        data?: { trackName?: string; artistName?: string; duration?: number; lines?: Array<{ timeSec?: number; text?: string }> };
      };
      const lines = (raw.data?.lines ?? [])
        .filter((l) => typeof l.timeSec === "number")
        .map((l) => ({ timeSec: l.timeSec as number, text: (l.text ?? "").trim() }));
      if (lines.length) {
        value = {
          trackName: raw.data?.trackName ?? track.title,
          artistName: raw.data?.artistName ?? track.artist,
          duration: raw.data?.duration ?? 210,
          lines,
        };
      }
    } catch {
      // Tidak ada lirik.
    }
  }
  lyricsCache.set(key, value);
  return value;
}

function LyricsSheet({
  track,
  lyrics,
  onClose,
}: {
  track: MusicTrack;
  lyrics: LyricsData;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const stopStable = useRef<() => void>(() => {});

  const command = useCallback((func: "playVideo" | "pauseVideo", args: unknown[] = []) => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }, []);

  stopStable.current = () => {
    command("pauseVideo");
    setPlaying(false);
  };

  useEffect(() => {
    const stop = () => stopStable.current();
    claimPlayback(stop);
    return () => releasePlayback(stop);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const msg = JSON.parse(event.data) as {
          event?: string;
          info?: { currentTime?: number; playerState?: number };
        };
        if (typeof msg.info?.currentTime === "number") setTime(msg.info.currentTime);
        if (typeof msg.info?.playerState === "number") setPlaying(msg.info.playerState === 1);
      } catch {
        // Abaikan pesan lain.
      }
    };
    window.addEventListener("message", onMessage);
    const timer = window.setInterval(() => {
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
        "*",
      );
    }, 400);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, []);

  const activeIndex = (() => {
    let idx = -1;
    lyrics.lines.forEach((line, i) => {
      if (time + 0.15 >= line.timeSec) idx = i;
    });
    return idx;
  })();

  useEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex < 0) return;
    const el = list.querySelector<HTMLElement>(`[data-line="${activeIndex}"]`);
    if (el) {
      list.scrollTo({
        top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  return (
    <div className="lyrics-overlay" role="dialog" aria-label={`Lirik ${track.title}`}>
      <button type="button" className="lyrics-backdrop" aria-label="Tutup lirik" onClick={onClose} />
      <div className="lyrics-sheet">
        <div className="lyrics-sheet-head">
          <div className="lyrics-sheet-title-row">
            {playing && <PlayingBars />}
            <span className="lyrics-sheet-title">{track.title}</span>
          </div>
          <span className="lyrics-sheet-artist">{track.artist}</span>
          <button type="button" className="lyrics-close" aria-label="Tutup" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="lyrics-lines" ref={listRef}>
          {lyrics.lines.map((line, i) =>
            line.text ? (
              <p
                key={`${line.timeSec}-${i}`}
                data-line={i}
                className={`lyrics-line${i === activeIndex ? " is-active" : ""}`}
              >
                <span className="lyrics-line-text">{line.text}</span>
              </p>
            ) : (
              <p key={`${line.timeSec}-${i}`} data-line={i} className="lyrics-gap" />
            ),
          )}
        </div>
        <iframe
          ref={frameRef}
          title={track.title}
          src={`https://www.youtube.com/embed/${track.id}?autoplay=1&enablejsapi=1&playsinline=1&controls=0`}
          allow="autoplay; encrypted-media"
          className="music-hidden-player"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

function LyricsCardBase({ query }: { query: string }) {
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let disposed = false;
    void prefetchMusic(query).then(async (value) => {
      if (disposed || value === "empty") return;
      setTrack(value);
      const found = await loadLyrics(value);
      if (!disposed && found !== "empty") setLyrics(found);
    });
    return () => {
      disposed = true;
    };
  }, [query]);

  if (!track || !lyrics) return null;

  return (
    <span className="music-block">
      <button type="button" className="music-card lyrics-card" onClick={() => setOpen(true)}>
        <span className="music-art lyrics-art">
          <ListMusic size={26} strokeWidth={1.8} />
        </span>
        <span className="music-info">
          <span className="music-title">Lyric lagu {track.title}</span>
          <span className="music-artist">{track.artist}</span>
        </span>
      </button>
      {open && <LyricsSheet track={track} lyrics={lyrics} onClose={() => setOpen(false)} />}
    </span>
  );
}

export const LyricsCard = memo(LyricsCardBase);

export default LyricsCard;
