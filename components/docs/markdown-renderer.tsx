type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; code: string; language: string };

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level === 1) {
            return (
              <h1 key={index} className="text-3xl font-semibold tracking-[-0.04em] text-[#fafafa] lg:text-4xl">
                {block.text}
              </h1>
            );
          }

          if (block.level === 2) {
            return (
              <h2 key={index} className="pt-2 text-xl font-semibold tracking-[-0.03em] text-[#fafafa]">
                {block.text}
              </h2>
            );
          }

          return (
            <h3 key={index} className="text-base font-semibold uppercase tracking-[0.2em] text-[#d4d4d8]">
              {block.text}
            </h3>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={index} className="text-sm leading-7 text-[#d4d4d8] lg:text-[15px]">
              {renderInlineMarkdown(block.text)}
            </p>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";

          return (
            <ListTag
              key={index}
              className={block.ordered ? "space-y-2 pl-5 text-sm leading-7 text-[#d4d4d8] list-decimal" : "space-y-2 pl-5 text-sm leading-7 text-[#d4d4d8] list-disc"}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <pre
            key={index}
            className="overflow-x-auto rounded-2xl border border-[#27272a] bg-[#09090b] p-4 text-sm leading-6 text-[#e4e4e7]"
          >
            <code>{block.code}</code>
          </pre>
        );
      })}
    </div>
  );
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: "code",
        code: codeLines.join("\n"),
        language,
      });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    const unorderedMatch = trimmed.match(/^-\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);

    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];

      while (index < lines.length) {
        const candidate = lines[index].trim();
        const match = ordered ? candidate.match(/^\d+\.\s+(.*)$/) : candidate.match(/^-\s+(.*)$/);

        if (!match) {
          break;
        }

        items.push(match[1].trim());
        index += 1;
      }

      blocks.push({
        type: "list",
        ordered,
        items,
      });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const candidate = lines[index].trim();

      if (!candidate) {
        break;
      }

      if (
        candidate.startsWith("```") ||
        candidate.match(/^(#{1,3})\s+/) ||
        candidate.match(/^-\s+/) ||
        candidate.match(/^\d+\.\s+/)
      ) {
        break;
      }

      paragraphLines.push(candidate);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return tokens.map((token, index) => {
    const codeMatch = token.match(/^`([^`]+)`$/);
    if (codeMatch) {
      return (
        <code key={index} className="rounded bg-[#18181b] px-1.5 py-0.5 text-[0.95em] text-[#fafafa]">
          {codeMatch[1]}
        </code>
      );
    }

    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={index} className="text-white underline decoration-[#52525b] underline-offset-4" href={linkMatch[2]}>
          {linkMatch[1]}
        </a>
      );
    }

    return token;
  });
}
