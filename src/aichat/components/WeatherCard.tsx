import { memo, useEffect, useState } from "react";
import type { WeatherSnapshot } from "@/routes/api/weather";

const cache = new Map<string, WeatherSnapshot | "empty">();
const pending = new Map<string, Promise<WeatherSnapshot | "empty">>();

function load(query: string): Promise<WeatherSnapshot | "empty"> {
  const hit = pending.get(query);
  if (hit) return hit;
  const task = (async () => {
    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
      if (!res.ok) return "empty" as const;
      const data = (await res.json()) as WeatherSnapshot;
      return data.city ? data : ("empty" as const);
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

function useWeather(query: string) {
  const [data, setData] = useState<WeatherSnapshot | "empty" | null>(cache.get(query) ?? null);
  useEffect(() => {
    const cached = cache.get(query);
    if (cached) {
      setData(cached);
      return;
    }
    let disposed = false;
    setData(null);
    void load(query).then((value) => {
      if (!disposed) setData(value);
    });
    return () => {
      disposed = true;
    };
  }, [query]);
  return data;
}

function Loading({ height }: { height: number }) {
  return (
    <span className="chat-media-loading" style={{ width: "100%", height }}>
      <span className="chat-media-spinner" />
    </span>
  );
}

function Missing({ query }: { query: string }) {
  return (
    <span className="chat-media-caption text-[12.5px] text-[#8a8a93]">
      Cuaca “{query}” tidak ditemukan
    </span>
  );
}

/** Kartu cuaca utama, dipakai lewat sintaks [cuaca={kota}]. */
function WeatherCardBase({ query }: { query: string }) {
  const data = useWeather(query);
  if (data === null) return <Loading height={118} />;
  if (data === "empty") return <Missing query={query} />;

  return (
    <span className="weather-block">
      <span className="weather-card" style={{ backgroundColor: data.bg }}>
        <span className="weather-card-left">
          <span className="weather-city-row">
            <span className="weather-city">{data.city}</span>
            {data.icon && (
              <img className="weather-icon" src={data.icon} alt={data.alt} loading="lazy" />
            )}
          </span>
          <span className="weather-meta">
            {data.meta.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </span>
        <span className="weather-temp">{data.temp}</span>
      </span>
    </span>
  );
}

/** Ramalan 5 hari, dipakai lewat sintaks [ramalan={kota}]. */
function WeatherForecastBase({ query }: { query: string }) {
  const data = useWeather(query);
  if (data === null) return <Loading height={96} />;
  if (data === "empty" || data.days.length === 0) return <Missing query={query} />;

  return (
    <span className="weather-block">
      <span className="weather-forecast">
        {data.days.map((day) => (
          <span key={day.day} className="weather-f-item" style={{ backgroundColor: day.bg }}>
            <span className="weather-f-day">{day.day}</span>
            {day.icon && (
              <img className="weather-icon" src={day.icon} alt={day.alt} loading="lazy" />
            )}
            <span className="weather-f-temp">{day.temp}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

export const WeatherCard = memo(WeatherCardBase);
export const WeatherForecast = memo(WeatherForecastBase);
