import { createFileRoute } from "@tanstack/react-router";

const BASE_HEADERS: Record<string, string> = {
  "User-Agent":
    "le-chat-mobile/2.3.0 (os_name:ios; device_model:iPhone 14 Pro; device_manufacturer:Apple)",
  Accept: "*/*",
  "Content-Type": "application/json",
};

type Auth = { cookie: string; id: string };

function readSetCookies(res: Response): string[] {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function parseCookies(list: string[]): string {
  const jar: Record<string, string> = {};
  for (const entry of list) {
    // A single header value may contain several cookies joined by ", "
    for (const piece of entry.split(/,(?=\s*[^=;,]+=)/)) {
      const first = piece.split(";")[0];
      if (!first) continue;
      const eq = first.indexOf("=");
      if (eq === -1) continue;
      const key = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      if (key) jar[key] = value;
    }
  }
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function getSession(): Promise<Auth> {
  const res = await fetch(
    "https://chat.mistral.ai/api/trpc/event.sendEventToDatalake,event.sendEventToDatalake?batch=1",
    {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        "0": { json: { name: "app_downloaded", properties: {} } },
        "1": {
          json: {
            name: "app_started",
            properties: { os: "iOS", deviceManufacturer: "Apple" },
          },
        },
      }),
    },
  );

  const cookie = parseCookies(readSetCookies(res));
  if (!cookie) {
    throw new Error("Tidak bisa membuat sesi chat (cookie kosong).");
  }

  await fetch("https://chat.mistral.ai/api/trpc/user.acceptToS?batch=1", {
    method: "POST",
    headers: { ...BASE_HEADERS, cookie },
    body: JSON.stringify({ "0": { json: {} } }),
  });

  return { cookie, id: crypto.randomUUID() };
}

async function createChat(prompt: string, auth: Auth): Promise<string | null> {
  const res = await fetch("https://chat.mistral.ai/api/trpc/message.newChat?batch=1", {
    method: "POST",
    headers: { ...BASE_HEADERS, cookie: auth.cookie },
    body: JSON.stringify({
      "0": {
        json: {
          files: [],
          content: [{ type: "text", text: prompt }],
          transcriptionsMetadata: null,
          agentId: null,
          agentsApiAgentId: null,
          features: ["beta-websearch"],
          integrations: [],
          libraries: [],
          productType: "chat",
          projectId: null,
          incognito: null,
          chatId: null,
          parentId: null,
          parentVersion: null,
        },
        meta: {
          values: {
            transcriptionsMetadata: ["undefined"],
            agentId: ["undefined"],
            agentsApiAgentId: ["undefined"],
            projectId: ["undefined"],
            incognito: ["undefined"],
            chatId: ["undefined"],
            parentId: ["undefined"],
            parentVersion: ["undefined"],
          },
          v: 1,
        },
      },
    }),
  });

  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) {
    const first = data[0] as { result?: { data?: { json?: { chatId?: string } } } } | undefined;
    return first?.result?.data?.json?.chatId ?? null;
  }
  return null;
}

/** Kumpulkan peta referenceId -> url dari hasil web search. */
function scanRefs(value: unknown, map: Map<string, string>): void {
  if (Array.isArray(value)) {
    for (const item of value) scanRefs(item, map);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { url?: unknown }).url === "string" &&
      /^[A-Za-z0-9_-]{6,16}$/.test(key)
    ) {
      map.set(key, (entry as { url: string }).url);
    } else {
      scanRefs(entry, map);
    }
  }
}

function collectText(value: unknown, push: (chunk: string) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, push);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as {
      contentChunks?: unknown;
      type?: unknown;
      text?: unknown;
      referenceIds?: unknown;
    };
    if (obj.contentChunks) {
      collectText(obj.contentChunks, push);
      return;
    }
    if (obj.type === "reference" && Array.isArray(obj.referenceIds)) {
      for (const id of obj.referenceIds) {
        if (typeof id === "string") push(`@@REF:${id}@@`);
      }
      return;
    }
    if (obj.type === "text" && typeof obj.text === "string") {
      push(obj.text);
    }
  }
}

/** Ubah penanda referensi berurutan menjadi satu chip sumber dengan jumlah sisanya. */
function renderRefs(text: string, refs: Map<string, string>): string {
  return text
    .replace(/(?:@@REF:[A-Za-z0-9_-]+@@\s*)+/g, (group) => {
      const ids = [...group.matchAll(/@@REF:([A-Za-z0-9_-]+)@@/g)]
        .map((match) => match[1])
        .filter((id): id is string => Boolean(id));
      const sources = new Map<string, string>();

      for (const id of ids) {
        const url = refs.get(id);
        if (!url) continue;
        try {
          const host = new URL(url).hostname.replace(/^www\./, "");
          if (!sources.has(host)) sources.set(host, url);
        } catch {
          // Abaikan URL referensi yang tidak valid.
        }
      }

      const first = sources.entries().next().value as [string, string] | undefined;
      if (!first) return "";
      const hiddenCount = sources.size - 1;
      const title = hiddenCount > 0 ? ` "sources:+${hiddenCount}"` : "";
      return `[${first[0]}](${first[1]}${title})`;
    })
    .replace(/([.!?])\s*(\[[^\]]+\]\([^\n)]+(?:\([^)]*\)[^)]*)?\))([.!?])/g, "$1 $2")
    .replace(/(\[[^\]]+\]\([^\n]+?\))\s*[.!?](?=\s*(?:\n|$))/gm, "$1");
}

async function streamAnswer(
  prompt: string,
  auth: Auth,
  chatId: string | null,
): Promise<{ response: string; chatId: string | null }> {
  const res = await fetch("https://chat.mistral.ai/api/chat", {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      cookie: auth.cookie,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      chatId,
      stableAnonymousIdentifier: auth.id,
      platform: "mobile",
      shouldAwaitStreamBackgroundTasks: true,
      shouldUseMessagePatch: true,
      features: ["beta-websearch"],
      integrations: [],
      libraries: [],
      mode: chatId ? "append" : "start",
      messageId: crypto.randomUUID(),
      messageInput: [
        {
          type: "text",
          text: `[Konteks waktu: hari ini ${new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" })}. Jika pertanyaan menyangkut berita/peristiwa terbaru, gunakan web search.
Aturan format jawaban:
1. Tulis semua rumus/matematika dengan LaTeX: inline pakai $...$ dan blok pakai $$...$$ (jangan pakai \\( \\) atau \\[ \\]).
2. WAJIB: setiap kali informasi berasal dari web search, sisipkan semua sitasi di AKHIR setiap paragraf/poin sebagai markdown link yang teksnya HANYA nama domain atau akronim media, contoh: [apnews.com](https://apnews.com/article/xxx) atau [AFP](https://www.afp.com). Sitasi menggantikan tanda baca penutup, jadi jangan tambahkan titik setelah sitasi. Setiap paragraf faktual harus punya minimal satu sitasi.
3. Jangan tulis URL mentah, jangan buat daftar "Sumber:" terpisah di akhir jawaban, dan jangan tambahkan pemisah "---" setelah sitasi.
4. Jika membuat tabel, gunakan tabel Markdown GFM. Tentukan perataan setiap kolom melalui baris pemisah: :--- untuk kiri, :---: untuk tengah, dan ---: untuk kanan. Buat isi sel ringkas agar mudah dibaca di layar kecil.]\n\n${prompt}`,
        },
      ],
      messageFiles: [],
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Upstream chat error (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const push = (chunk: string) => {
    text += chunk;
  };

  const refs = new Map<string, string>();

  const handleLine = (line: string) => {
    const match = line.trim().match(/^\d+:(.*)$/);
    if (!match || !match[1]) return;
    try {
      const parsed = JSON.parse(match[1]) as { json?: { patches?: unknown } };
      const patches = parsed?.json?.patches;
      if (!Array.isArray(patches)) return;
      for (const patch of patches as Array<{ path?: unknown; value?: unknown }>) {
        scanRefs(patch.value, refs);
        if (
          typeof patch.path === "string" &&
          patch.path.includes("/text") &&
          typeof patch.value === "string"
        ) {
          push(patch.value);
        } else {
          collectText(patch.value, push);
        }
      }
    } catch {
      // ignore malformed frames
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  if (buffer) handleLine(buffer);

  return { response: renderRefs(text, refs).trim(), chatId };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { prompt?: unknown; auth?: unknown; chatId?: unknown };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
        }

        const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
        if (!prompt) {
          return Response.json({ error: "Prompt kosong." }, { status: 400 });
        }

        const incomingAuth = payload.auth as Auth | undefined;
        const chatId = typeof payload.chatId === "string" ? payload.chatId : null;

        try {
          const auth = incomingAuth?.cookie && incomingAuth?.id ? incomingAuth : await getSession();

          const activeChatId = chatId ?? (await createChat(prompt, auth));
          const result = await streamAnswer(prompt, auth, activeChatId);

          if (!result.response) {
            return Response.json(
              { error: "Model tidak mengembalikan jawaban. Coba lagi." },
              { status: 502 },
            );
          }

          return Response.json({
            response: result.response,
            chatId: result.chatId,
            auth,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
