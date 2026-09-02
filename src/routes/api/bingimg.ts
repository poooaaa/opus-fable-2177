import { createFileRoute } from "@tanstack/react-router";

type Item = { url?: unknown; title?: unknown };

export const Route = createFileRoute("/api/bingimg")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.trim();
        if (!q) return Response.json({ error: "Query kosong." }, { status: 400 });

        try {
          const res = await fetch(
            `https://opus-dev-v1.vercel.app/api/v1/search/bingimg?q=${encodeURIComponent(q)}`,
            { headers: { Accept: "application/json" } },
          );
          const data = (await res.json()) as unknown;
          const list = Array.isArray(data) ? (data as Item[]) : [];
          const images = list
            .filter((item) => typeof item.url === "string")
            .slice(0, 8)
            .map((item) => ({
              url: item.url as string,
              title: typeof item.title === "string" ? item.title : "",
            }));
          return Response.json(
            { images },
            { headers: { "Cache-Control": "public, max-age=3600" } },
          );
        } catch {
          return Response.json({ error: "Gagal mengambil gambar." }, { status: 502 });
        }
      },
    },
  },
});
