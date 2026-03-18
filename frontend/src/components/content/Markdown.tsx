import React from "react";

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

function parseMarkdownLite(input: string): Block[] {
  const lines = String(input || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (text) blocks.push({ type: "p", text });
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length) blocks.push({ type: "ul", items: listItems });
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    const heading =
      trimmed.startsWith("### ")
        ? ({ type: "h3", text: trimmed.slice(4).trim() } as const)
        : trimmed.startsWith("## ")
          ? ({ type: "h2", text: trimmed.slice(3).trim() } as const)
          : trimmed.startsWith("# ")
            ? ({ type: "h1", text: trimmed.slice(2).trim() } as const)
            : null;

    if (heading) {
      flushList();
      flushParagraph();
      blocks.push(heading);
      continue;
    }

    const isList = /^[-*]\s+/.test(trimmed);
    if (isList) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[-*]\s+/, "").trim());
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushList();
  flushParagraph();
  return blocks;
}

export default function Markdown({ content }: { content: string }) {
  const blocks = React.useMemo(() => parseMarkdownLite(content), [content]);
  return (
    <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24">
      {blocks.map((b, idx) => {
        if (b.type === "h1") return <h1 key={idx}>{b.text}</h1>;
        if (b.type === "h2") return <h2 key={idx}>{b.text}</h2>;
        if (b.type === "h3") return <h3 key={idx}>{b.text}</h3>;
        if (b.type === "ul")
          return (
            <ul key={idx}>
              {b.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          );
        return <p key={idx}>{b.text}</p>;
      })}
    </div>
  );
}

