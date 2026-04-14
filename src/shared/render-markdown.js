function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function flushParagraph(buffer, blocks) {
  if (!buffer.length) return;
  blocks.push(`<p>${renderInline(buffer.join(" "))}</p>`);
  buffer.length = 0;
}

function flushList(items, ordered, blocks) {
  if (!items.length) return;
  const tag = ordered ? "ol" : "ul";
  const renderedItems = items.map((item) => `<li>${renderInline(item)}</li>`).join("");
  blocks.push(`<${tag}>${renderedItems}</${tag}>`);
  items.length = 0;
}

function flushQuote(lines, blocks) {
  if (!lines.length) return;
  blocks.push(`<blockquote>${lines.map((line) => `<p>${renderInline(line)}</p>`).join("")}</blockquote>`);
  lines.length = 0;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^[:|\-\s]+$/.test(line.trim());
}

function renderTableBlock(lines) {
  const [headerLine, , ...bodyLines] = lines;
  const header = splitTableRow(headerLine);
  const headMarkup = `<tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr>`;
  const bodyMarkup = bodyLines
    .map((line) => splitTableRow(line))
    .filter((row) => row.some(Boolean))
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `<div class="table-shell"><table><thead>${headMarkup}</thead><tbody>${bodyMarkup}</tbody></table></div>`;
}

function renderCodeBlock(code, language) {
  const escapedLanguage = escapeHtml(language);
  const languageClass = language ? ` class="language-${escapedLanguage}"` : "";
  const languageLabel = language ? `<div class="code-language-label">${escapedLanguage}</div>` : "";
  return `<div class="code-block-shell">${languageLabel}<pre><code${languageClass}>${escapeHtml(code)}</code></pre></div>`;
}

export function renderMarkdown(content) {
  const normalized = String(content || "").replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return "";

  const lines = normalized.split("\n");
  const blocks = [];
  const paragraph = [];
  const bulletItems = [];
  const orderedItems = [];
  const quoteLines = [];

  let inFence = false;
  let fenceLanguage = "";
  let fenceLines = [];

  function flushOpenBlocks() {
    flushParagraph(paragraph, blocks);
    flushList(bulletItems, false, blocks);
    flushList(orderedItems, true, blocks);
    flushQuote(quoteLines, blocks);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (inFence) {
      if (line.startsWith("```")) {
        blocks.push(renderCodeBlock(fenceLines.join("\n"), fenceLanguage));
        inFence = false;
        fenceLanguage = "";
        fenceLines = [];
      } else {
        fenceLines.push(line);
      }
      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushOpenBlocks();
      inFence = true;
      fenceLanguage = trimmed.slice(3).trim();
      fenceLines = [];
      continue;
    }

    if (!trimmed) {
      flushOpenBlocks();
      continue;
    }

    const nextLine = lines[index + 1];
    if (trimmed.includes("|") && nextLine && isTableSeparator(nextLine)) {
      flushOpenBlocks();
      const tableLines = [trimmed, nextLine.trim()];
      let offset = index + 2;

      while (offset < lines.length && lines[offset].trim().includes("|")) {
        tableLines.push(lines[offset].trim());
        offset += 1;
      }

      blocks.push(renderTableBlock(tableLines));
      index = offset - 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushOpenBlocks();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph(paragraph, blocks);
      flushList(bulletItems, false, blocks);
      flushList(orderedItems, true, blocks);
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph(paragraph, blocks);
      flushList(bulletItems, false, blocks);
      flushQuote(quoteLines, blocks);
      orderedItems.push(orderedMatch[2]);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph(paragraph, blocks);
      flushList(orderedItems, true, blocks);
      flushQuote(quoteLines, blocks);
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    flushList(bulletItems, false, blocks);
    flushList(orderedItems, true, blocks);
    flushQuote(quoteLines, blocks);
    paragraph.push(trimmed);
  }

  if (inFence) {
    blocks.push(renderCodeBlock(fenceLines.join("\n"), fenceLanguage));
  } else {
    flushOpenBlocks();
  }

  return blocks.join("");
}
