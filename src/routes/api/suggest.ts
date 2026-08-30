import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/suggest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q") || "";
        if (!q) {
          return Response.json(["", []]);
        }
        try {
          const res = await fetch(
            `https://suggestqueries.google.com/complete/search?client=chrome&hl=id&q=${encodeURIComponent(q)}`
          );
          if (!res.ok) {
            return Response.json(["", []], { status: res.status });
          }
          const data = await res.json();
          return Response.json(data);
        } catch {
          return Response.json(["", []], { status: 500 });
        }
      },
    },
  },
});
