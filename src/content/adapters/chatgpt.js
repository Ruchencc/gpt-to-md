function textFromNode(node) {
  return node?.innerText?.trim() || "";
}

function makeGroupTitle(questionText, index) {
  const normalized = questionText.replace(/\s+/g, " ").trim();
  if (!normalized) return `Question ${index + 1}`;
  return normalized.slice(0, 72) + (normalized.length > 72 ? "..." : "");
}

function flushParagraphBuffer(blocks, paragraphBuffer) {
  if (!paragraphBuffer.length) return;

  blocks.push({
    id: `paragraph-${blocks.length + 1}`,
    type: "paragraph",
    text: paragraphBuffer.join("\n\n")
  });
  paragraphBuffer.length = 0;
}

function pushModule(modules, currentModule) {
  if (!currentModule.blocks.length) return;

  modules.push({
    id: `module-${modules.length + 1}`,
    title: currentModule.title || "Response",
    blocks: [...currentModule.blocks]
  });

  currentModule.title = "Response";
  currentModule.blocks = [];
}

function modulesFromAssistantNode(node) {
  const modules = [];
  const paragraphBuffer = [];
  const currentModule = { title: "Response", blocks: [] };

  function flushIntoCurrentModule() {
    flushParagraphBuffer(currentModule.blocks, paragraphBuffer);
  }

  node.querySelectorAll("h2, h3, h4, p, pre, blockquote, ul, ol").forEach((child, index) => {
    if (child.matches("h2")) {
      flushIntoCurrentModule();
      pushModule(modules, currentModule);
      currentModule.title = textFromNode(child) || `Section ${modules.length + 1}`;
      return;
    }

    if (child.matches("h3, h4")) {
      const headingText = textFromNode(child);
      if (headingText) paragraphBuffer.push(headingText);
      return;
    }

    if (child.matches("pre")) {
      flushIntoCurrentModule();
      currentModule.blocks.push({
        id: `code-${index}`,
        type: "code",
        code: textFromNode(child)
      });
      return;
    }

    if (child.matches("blockquote")) {
      flushIntoCurrentModule();
      currentModule.blocks.push({
        id: `quote-${index}`,
        type: "quote",
        text: textFromNode(child)
      });
      return;
    }

    if (child.matches("ul, ol")) {
      flushIntoCurrentModule();
      currentModule.blocks.push({
        id: `list-${index}`,
        type: "list",
        items: Array.from(child.querySelectorAll("li")).map((item) => textFromNode(item))
      });
      return;
    }

    if (child.matches("p")) {
      const paragraphText = textFromNode(child);
      if (paragraphText) paragraphBuffer.push(paragraphText);
    }
  });

  flushIntoCurrentModule();
  pushModule(modules, currentModule);

  if (!modules.length) {
    const fallbackText = textFromNode(node);
    if (fallbackText) {
      modules.push({
        id: "module-1",
        title: "Response",
        blocks: [{ id: "paragraph-1", type: "paragraph", text: fallbackText }]
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
    groups.push({
      id: `group-${groups.length + 1}`,
      included: true,
      title: makeGroupTitle(textFromNode(current.node), groups.length),
      notes: "",
      question: textFromNode(current.node),
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
