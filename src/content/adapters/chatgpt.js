function textFromNode(node) {
  if (!node) return "";

  const clone = node.cloneNode?.(true);
  clone?.querySelectorAll?.("img, picture, svg, canvas, video, audio, source").forEach((mediaNode) => mediaNode.remove());
  return clone?.innerText?.trim() || node?.innerText?.trim() || "";
}

function codeTextFromNode(node) {
  return node?.textContent?.replace(/\r\n?/g, "\n").trim() || "";
}

function codeLanguageFromNode(node) {
  const candidates = [
    node.getAttribute?.("data-language"),
    node.querySelector?.("[data-language]")?.getAttribute("data-language"),
    node.closest?.("[data-language]")?.getAttribute("data-language"),
    node.previousElementSibling?.getAttribute?.("data-language"),
    node.parentElement?.getAttribute?.("data-language"),
    node.parentElement?.dataset?.language,
    node.closest?.("[class*='language-']")?.className
      ?.split(/\s+/)
      .find((token) => token.startsWith("language-"))
      ?.slice("language-".length)
  ];

  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function makeGroupTitle(questionText, index) {
  const normalized = questionText.replace(/\s+/g, " ").trim();
  if (!normalized) return `Question ${index + 1}`;
  return normalized.slice(0, 72) + (normalized.length > 72 ? "..." : "");
}

function nearestMatchedAncestor(node) {
  return node.parentElement?.closest?.("h2, h3, h4, p, pre, blockquote, ul, ol, table") || null;
}

function isTopLevelBlock(node, root) {
  const ancestor = nearestMatchedAncestor(node);
  return !ancestor || !root.contains(ancestor);
}

function blockToMarkdown(node) {
  if (node.matches("pre")) {
    const language = codeLanguageFromNode(node);
    const code = codeTextFromNode(node);
    if (!code) return "";
    return [`\`\`\`${language}`, code, "```"].join("\n");
  }

  if (node.matches("h3, h4")) {
    const level = node.matches("h3") ? "###" : "####";
    const text = textFromNode(node);
    return text ? `${level} ${text}` : "";
  }

  if (node.matches("blockquote")) {
    const quotedLines = textFromNode(node)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `> ${line}`)
      .join("\n");
    return quotedLines;
  }

  if (node.matches("ul, ol")) {
    const items = Array.from(node.children)
      .filter((item) => item.matches?.("li"))
      .map((item) => textFromNode(item))
      .map((text) => text.trim())
      .filter(Boolean);

    return items
      .map((item, index) => (node.matches("ol") ? `${index + 1}. ${item}` : `- ${item}`))
      .join("\n");
  }

  if (node.matches("table")) {
    const rows = Array.from(node.querySelectorAll("tr"))
      .map((row) =>
        Array.from(row.querySelectorAll("th, td"))
          .map((cell) => textFromNode(cell).replace(/\s+/g, " ").trim())
          .filter(Boolean)
      )
      .filter((row) => row.length);

    if (rows.length < 2) {
      return rows.map((row) => row.join(" | ")).join("\n");
    }

    const header = rows[0];
    const divider = header.map(() => "---");
    const body = rows.slice(1);

    return [
      `| ${header.join(" | ")} |`,
      `| ${divider.join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
  }

  const text = textFromNode(node);
  return text;
}

function pushModule(modules, currentModule) {
  const content = currentModule.parts.join("\n\n").trim();
  if (!content) return;

  modules.push({
    id: `module-${modules.length + 1}`,
    title: currentModule.title || "Response",
    content
  });

  currentModule.title = "Response";
  currentModule.parts = [];
}

function modulesFromAssistantNode(node) {
  const modules = [];
  const currentModule = { title: "Response", parts: [] };

  Array.from(node.querySelectorAll("h2, h3, h4, p, pre, blockquote, ul, ol, table"))
    .filter((child) => isTopLevelBlock(child, node))
    .forEach((child) => {
    if (child.matches("h2")) {
      const headingText = textFromNode(child);
      if (!headingText) return;
      pushModule(modules, currentModule);
      currentModule.title = headingText || `Section ${modules.length + 1}`;
      return;
    }

    const markdown = blockToMarkdown(child);
    if (markdown) {
      currentModule.parts.push(markdown);
    }
    });

  pushModule(modules, currentModule);

  if (!modules.length) {
    const fallbackText = textFromNode(node);
    if (fallbackText) {
      modules.push({
        id: "module-1",
        title: "Response",
        content: fallbackText
      });
    }
  }

  return modules;
}

function extractChatGptConversation(document) {
  const messages = Array.from(document.querySelectorAll("[data-message-author-role]")).map((node) => ({
    role: node.getAttribute("data-message-author-role"),
    node
  }));

  const groups = [];

  for (let index = 0; index < messages.length; index += 1) {
    const current = messages[index];
    if (current.role !== "user") continue;

    const next = messages[index + 1];
    const question = textFromNode(current.node);
    groups.push({
      id: `group-${groups.length + 1}`,
      included: true,
      title: makeGroupTitle(question, groups.length),
      notes: "",
      question,
      modules: next?.role === "assistant" ? modulesFromAssistantNode(next.node) : []
    });
  }

  return {
    source: {
      site: "chatgpt",
      label: "ChatGPT",
      url: document.location.href
    },
    title: document.title.replace(/\s*-\s*ChatGPT\s*$/i, "").trim() || "ChatGPT Conversation",
    groups
  };
}

globalThis.chatExportChatGptAdapter = {
  extractChatGptConversation
};
