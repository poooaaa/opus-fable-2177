import { createFileRoute } from "@tanstack/react-router";

export type WeatherDay = {
  day: string;
  icon: string;
  alt: string;
  temp: string;
  bg: string;
};

export type WeatherSnapshot = {
  city: string;
  temp: string;
  icon: string;
  alt: string;
  bg: string;
  meta: string[];
  days: WeatherDay[];
};

function decode(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Ambil bagian kartu cuaca utama + ramalan dari HTML, buang form pencarian. */
export function parseWeatherHtml(html: string): WeatherSnapshot | null {
  const cardMatch = html.match(/<div class="city-card"([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  if (!cardMatch) return null;
  const card = cardMatch[0];

  const bg = card.match(/city-card"\s+style="background-color:([^"]+)"/)?.[1]?.trim() ?? "#4A6E8A";
  const city = decode(card.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] ?? "");
  const icon = card.match(/<img class="cond-icon" src="([^"]+)"/)?.[1] ?? "";
  const alt = decode(card.match(/<img class="cond-icon"[^>]*alt="([^"]*)"/)?.[1] ?? "");
  const temp = decode(card.match(/<div class="card-temp">([\s\S]*?)<\/div>/)?.[1] ?? "");
  const meta = [...card.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1] ?? ""));

  const forecastBlock = html.match(/<div class="forecast">([\s\S]*?)<\/div>\s*<\/div>\s*<\/body>/);
  const days: WeatherDay[] = [];
  const source = forecastBlock?.[1] ?? "";
  for (const item of source.matchAll(
    /<div class="f-item" style="background-color:([^"]+)">([\s\S]*?)<\/div>\s*(?=<div class="f-item"|$)/g,
  )) {
    const body = item[2] ?? "";
    days.push({
      bg: (item[1] ?? "#4A6E8A").trim(),
      day: decode(body.match(/<div class="f-day">([\s\S]*?)<\/div>/)?.[1] ?? ""),
      icon: body.match(/<img class="cond-icon" src="([^"]+)"/)?.[1] ?? "",
      alt: decode(body.match(/<img class="cond-icon"[^>]*alt="([^"]*)"/)?.[1] ?? ""),
      temp: decode(body.match(/<div class="f-temp">([\s\S]*?)<\/div>/)?.[1] ?? ""),
    });
  }

  if (!city) return null;
  return { city, temp, icon, alt, bg, meta, days };
}

export async function fetchWeather(query: string): Promise<WeatherSnapshot | null> {
  const res = await fetch(
    `https://ymbciydehaolmpfrzbvo.supabase.co/functions/v1/weather-snapshot?q=${encodeURIComponent(query)}`,
    { headers: { Accept: "text/html" } },
  );
  if (!res.ok) return null;
  return parseWeatherHtml(await res.text());
}

export const Route = createFileRoute("/api/weather")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.trim();
        if (!q) return Response.json({ error: "Query kosong." }, { status: 400 });
        try {
          const data = await fetchWeather(q);
          if (!data) return Response.json({ error: "Cuaca tidak ditemukan." }, { status: 404 });
          return Response.json(data, {
            headers: { "Cache-Control": "public, max-age=600" },
          });
        } catch {
          return Response.json({ error: "Gagal mengambil cuaca." }, { status: 502 });
        }
      },
    },
  },
});
