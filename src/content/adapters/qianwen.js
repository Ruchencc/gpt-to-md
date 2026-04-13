function textFromNode(node) {
  return node?.innerText?.trim() || "";
}

function makeGroupTitle(questionText, index) {
  const normalized = questionText.replace(/\s+/g, " ").trim();
  if (!normalized) return `Question ${index + 1}`;
  return normalized.slice(0, 72) + (normalized.length > 72 ? "..." : "");
}

function blockToMarkdown(node) {
  if (node.matches("pre")) {
    return ["```", textFromNode(node), "```"].join("\n");
  }

  if (node.matches("blockquote")) {
    return textFromNode(node)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (node.matches("ul, ol")) {
    return Array.from(node.querySelectorAll("li"))
      .map((item, index) => (node.matches("ol") ? `${index + 1}. ${textFromNode(item)}` : `- ${textFromNode(item)}`))
      .join("\n");
  }

  return textFromNode(node);
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

  node.querySelectorAll("h2, h3, h4, p, pre, blockquote, ul, ol").forEach((child) => {
    if (child.matches("h2")) {
      pushModule(modules, currentModule);
      currentModule.title = textFromNode(child) || `Section ${modules.length + 1}`;
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

function extractQianwenConversation(document) {
  const messageNodes = Array.from(document.querySelectorAll("[class*='message'], [data-role], [class*='chat-item']"));
  const normalized = messageNodes
    .map((node) => {
      const raw = (node.getAttribute("data-role") || node.className || "").toLowerCase();
      if (raw.includes("user")) return { role: "user", node };
      if (raw.includes("assistant") || raw.includes("bot")) return { role: "assistant", node };
      return null;
    })
    .filter(Boolean);

  const groups = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    if (current.role !== "user") continue;
    const next = normalized[index + 1];
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
      site: "qianwen",
      label: "Qianwen",
      url: document.location.href
    },
    title: document.title.replace(/\s*-\s*通义千问\s*$/i, "").trim() || "Qianwen Conversation",
    groups
  };
}

globalThis.chatExportQianwenAdapter = {
  extractQianwenConversation
};
