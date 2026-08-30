import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** Sumber ditampilkan sebagai chip kecil (mis. "apnews.com", "AFP"). */
function isSourceLabel(label: string): boolean {
  const t = label.trim();
  if (!t || t.length > 28) return false;
  if (/\s/.test(t)) return false;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(t)) return true; // domain
  return /^[A-Z0-9.&-]{2,10}$/.test(t); // akronim: AFP, BBC, AP, Xinhua…
}

function SourceChip({
  href,
  label,
  extraCount = 0,
}: {
  href?: string | undefined;
  label: string;
  extraCount?: number;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mx-[3px] inline-flex items-center gap-1 rounded-md bg-source px-[7px] py-[2px] align-[1px] text-[12.5px] font-normal leading-[1.35] tracking-normal text-source-foreground no-underline transition-colors hover:bg-source-hover hover:text-foreground"
    >
      {label}
      {extraCount > 0 && <span className="text-source-count">+{extraCount}</span>}
    </a>
  );
}

/** URL mentah -> markdown link dengan label domain, agar tampil sebagai chip sumber. */
function normalizeSources(input: string): string {
  return input
    .replace(/\\\((.+?)\\\)/gs, (_m, m1) => `$${m1}$`)
    .replace(/\\\[(.+?)\\\]/gs, (_m, m1) => `$$${m1}$$`)
    .replace(/(^|[\s(])(https?:\/\/([^\s)>\]]+))/g, (_m, pre: string, url: string) => {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        return `${pre}[${host}](${url})`;
      } catch {
        return `${pre}${url}`;
      }
    })
    .replace(/(\[[^\]]+\]\([^\n]+?\))\s*[.!?](?=\s*(?:\n|$))/gm, "$1")
    .replace(/(\[[^\]]+\]\([^\n]+?\))[ \t]*-{3,}[ \t]*(?=\n|$)/gm, "$1")
    .replace(/(\[[^\]]+\]\([^\n]+?\))[ \t]*\n[ \t]*-{3,}[ \t]*(?=\n|$)/gm, "$1\n");
}

function alignmentClass(node: unknown): string {
  const align = (node as { properties?: { align?: unknown } } | undefined)?.properties?.align;
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

export function MarkdownText({ text }: { text: string }) {
  const content = normalizeSources(text);
  return (
    <div className="text-[#ececee] text-[16.5px] sm:text-[17.5px] leading-[1.5] font-normal tracking-[-0.01em] break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="my-2.5 whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="opacity-60">{children}</del>,
          h1: ({ children }) => (
            <h1 className="text-[21px] font-semibold text-white mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[19px] font-semibold text-white mt-4 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[17.5px] font-semibold text-white mt-3.5 mb-1.5">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[16.5px] font-semibold text-white mt-3 mb-1.5">{children}</h4>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 my-2.5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2.5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="marker:text-[#8a8a93]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#3a3a40] pl-3 my-2.5 text-[#b9b9c0] italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-0 h-px bg-[#2e2e34]" />,
          a: ({ children, href, title }) => {
            const label = typeof children === "string" ? children : String(children ?? "");
            if (isSourceLabel(label)) {
              const extraCount = title?.startsWith("sources:+")
                ? Number.parseInt(title.slice(9), 10) || 0
                : 0;
              return <SourceChip href={href} label={label.trim()} extraCount={extraCount} />;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[#d7573b] underline underline-offset-2 hover:opacity-80"
              >
                {children}
              </a>
            );
          },
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || "") || String(children).includes("\n");
            if (isBlock) {
              return (
                <code
                  className="block w-full overflow-x-auto rounded-lg bg-[#1a1a1e] border border-[#2a2a30] p-3 text-[13.5px] font-mono leading-relaxed text-[#e4e4e7]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-[#232328] px-1.5 py-0.5 text-[14px] font-mono text-[#f0b8a6]"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-3 w-full overflow-x-auto">{children}</pre>,
          table: ({ children }) => (
            <div className="chat-table-scroll my-5 w-full max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-max min-w-full table-auto border-collapse text-[15px] leading-relaxed">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-table-header">{children}</thead>,
          tbody: ({ children }) => <tbody className="bg-table-body">{children}</tbody>,
          th: ({ children, node }) => (
            <th
              className={`min-w-[110px] max-w-[330px] border border-table-border px-5 py-4 align-top font-semibold text-foreground whitespace-normal break-words ${alignmentClass(node)}`}
            >
              {children}
            </th>
          ),
          td: ({ children, node }) => (
            <td
              className={`min-w-[110px] max-w-[330px] border border-table-border px-5 py-4 align-top whitespace-normal break-words ${alignmentClass(node)}`}
            >
              {children}
            </td>
          ),
          img: ({ src, alt }) => (
            <img
              src={src as string}
              alt={alt || ""}
              className="my-3 rounded-lg max-w-full h-auto"
              loading="lazy"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownText;
