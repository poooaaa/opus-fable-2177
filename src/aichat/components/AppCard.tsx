import { memo, useState } from "react";
import { Code2, Download } from "lucide-react";

/** Ganti placeholder {{img:kata kunci}} dengan URL gambar hasil pencarian. */
async function resolveImages(html: string): Promise<string> {
  const keys = Array.from(new Set(
    Array.from(html.matchAll(/\{\{\s*img\s*:\s*([^}]+?)\s*\}\}/g)).map((m) => (m[1] ?? "").trim()),
  )).filter(Boolean);
  if (keys.length === 0) return html;

  const entries = await Promise.all(
    keys.map(async (q) => {
      try {
        const res = await fetch(`/api/bingimg?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { images?: Array<{ url?: string }> };
        return [q, data.images?.[0]?.url ?? ""] as const;
      } catch {
        return [q, ""] as const;
      }
    }),
  );
  const map = new Map(entries);
  return html.replace(/\{\{\s*img\s*:\s*([^}]+?)\s*\}\}/g, (_m, q: string) => map.get(q.trim()) || "");
}

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "aplikasi"
  );
}

function AppCardBase({ name, code }: { name: string; code: string }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const html = await resolveImages(code);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(name)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="music-block">
      <button type="button" className="music-card app-card" onClick={download}>
        <span className="music-art app-art">
          <Code2 size={26} strokeWidth={2.2} />
        </span>
        <span className="music-info">
          <span className="music-title-row">
            <span className="music-title">{name}</span>
          </span>
          <span className="music-artist">.html</span>
        </span>
        <span className="music-toggle" aria-hidden="true">
          <Download size={18} strokeWidth={2.2} className={busy ? "app-busy" : ""} />
        </span>
      </button>
    </span>
  );
}

export const AppCard = memo(AppCardBase);

export default AppCard;
