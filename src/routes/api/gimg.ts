import { createFileRoute } from "@tanstack/react-router";

const NID =
  "534=FRsb06yREkoXVEB8CKNITU5K8HTcx3y741Eg_QDN4MjKxBiuMCD8lcSuZi36lxvEoiUstRhL1COb2LMQZqhfhrHS4OvJIfBK6TZhKzeFNQt6NrgYZDm9LKN0z5fAXb1B02ZMMwImXAHQLO9ogy70znVfQJm6sRtmSFvp20ScBXmUjwx9xE6RX_EdtNBSvB4PGvB-4Tx_eacO31t6eISnAsId8kypbh6oXytpKWK7GBNbdylXU2fSBQTG8xUagI_Q-cwH8Mxt24JPbjiTi1p2FbPXIw";

/** Pencarian gambar Google sebagai cadangan ketika hasil Bing rasionya terlalu jomplang. */
export const Route = createFileRoute("/api/gimg")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.trim();
        if (!q) return Response.json({ error: "Query kosong." }, { status: 400 });

        const url = new URL("https://www.google.com/search");
        url.search = new URLSearchParams({
          as_st: "y",
          as_q: q,
          authuser: "0",
          udm: "2",
          safe: "off",
          gl: "us",
          hl: "en",
        }).toString();

        try {
          const res = await fetch(url, {
            headers: {
              accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              cookie: `NID=${NID}`,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
            },
          });
          const html = await res.text();
          const block = html.match(/var m=(\{.+?\});var a=m/s)?.[1] ?? html;

          const seen = new Set<string>();
          const images: Array<{ url: string; title: string }> = [];
          for (const match of block.matchAll(/"(https?:\/\/[^"\\]+?\.(?:jpg|jpeg|png|webp)[^"\\]*)"/gi)) {
            const link = match[1];
            if (!link || seen.has(link)) continue;
            if (link.includes("gstatic.com") || link.includes("google.com")) continue;
            seen.add(link);
            images.push({ url: link, title: q });
            if (images.length >= 10) break;
          }

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
