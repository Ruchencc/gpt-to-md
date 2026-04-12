import { defaultPreset } from "../shared/default-preset.js";
import { createInitialState } from "../shared/model.js";
import { exportMarkdown } from "../shared/export-markdown.js";
import { runtimeMessages } from "../shared/messages.js";

const app = document.getElementById("app");
const PREVIEW_STORAGE_KEY = "chat-export-preview-document";

const state = {
  preset: structuredClone(defaultPreset),
  document: createInitialState(),
  activeTabId: null,
  activeGroupId: null
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBlockBody(block) {
  if (block.type === "paragraph") return `<p>${escapeHtml(block.text)}</p>`;
  if (block.type === "quote") return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
  if (block.type === "list") {
    return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }
  if (block.type === "code") {
    return `<pre><code>${escapeHtml(block.code)}</code></pre>`;
  }
  return "";
}

function renderModuleBody(module) {
  return module.blocks.map((block) => renderBlockBody(block)).join("");
}

function applyPreset() {
  const root = document.documentElement;
  root.dataset.theme = state.preset.theme;

  Object.entries(state.preset.controls).forEach(([key, value]) => {
    const unit = ["base-font-size", "heading-size", "card-gap", "panel-padding", "radius"].includes(key)
      ? "px"
      : ["editor-fr", "preview-fr"].includes(key)
        ? "fr"
        : "";
    root.style.setProperty(`--${key}`, `${value}${unit}`);
  });
}

function downloadMarkdownFile() {
  const markdown = exportMarkdown(state.document);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeTitle = (state.document.title || "chat-to-md")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  anchor.href = url;
  anchor.download = `${safeTitle || "chat-to-md"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function openPreviewTab() {
  await chrome.storage.local.set({
    [PREVIEW_STORAGE_KEY]: {
      theme: state.preset.theme,
      document: state.document
    }
  });

  await chrome.tabs.create({
    url: chrome.runtime.getURL("preview.html")
  });
}

function groupCard(group) {
  return `
    <article class="group-card ${group.included ? "" : "excluded"}" data-group-id="${group.id}" id="group-${group.id}">
      <div class="group-card-header">
        <input class="checkbox" type="checkbox" ${group.included ? "checked" : ""} data-action="toggle-group" data-group-id="${group.id}" />
        <div>
          <input class="group-title-input" type="text" value="${escapeHtml(group.title)}" data-action="edit-title" data-group-id="${group.id}" />
          <textarea class="notes-input" data-action="edit-notes" data-group-id="${group.id}" placeholder="Add note for this section...">${escapeHtml(group.notes)}</textarea>
        </div>
        <button class="icon-button danger" type="button" data-action="delete-group" data-group-id="${group.id}">Delete</button>
      </div>
      <div class="block-list">
        <div class="block-card">
          <div class="block-topline">
            <span class="block-tag">Question</span>
          </div>
          <div class="block-body"><p>${escapeHtml(group.question)}</p></div>
        </div>
        ${group.modules
          .map(
            (module) => `
              <div class="block-card module-card">
                <div class="block-topline">
                  <span class="block-tag">${escapeHtml(module.title || "Response")}</span>
                  <button class="ghost-button danger" type="button" data-action="delete-module" data-group-id="${group.id}" data-module-id="${module.id}">Remove module</button>
                </div>
                <div class="block-body">${renderModuleBody(module)}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function render() {
  applyPreset();

  if (!state.activeGroupId && state.document.groups.length) {
    state.activeGroupId = state.document.groups[0].id;
  }

  app.innerHTML = `
    <main class="panel workspace">
      <header class="panel-header workspace-header" id="outline-top">
        <div class="top-toolbar">
          <button class="toolbar-button" id="loadThisPageButton" type="button">Load This Page</button>
          <button class="toolbar-button" id="themeToggleButton" type="button">${state.preset.theme === "dark" ? "Light mode" : "Dark mode"}</button>
          <button class="toolbar-button primary" id="downloadMarkdownButton" type="button">Download Markdown</button>
          <button class="toolbar-button" id="previewButton" type="button">Preview</button>
        </div>
        <div class="workspace-meta">
          <span>Source: ${escapeHtml(state.document.source.label)}</span>
          <span class="meta-url">${escapeHtml(state.document.source.url || "No page loaded yet.")}</span>
        </div>
        <div class="action-feedback" id="actionFeedback">Click Load This Page while a ChatGPT or Qianwen conversation tab is active.</div>
        <input id="docTitle" class="title-input" type="text" value="${escapeHtml(state.document.title)}" />
        <nav class="outline-nav" aria-label="Conversation outline">
          ${state.document.groups
            .map(
              (group, index) => `
                <a class="outline-link ${state.activeGroupId === group.id ? "active" : ""}" href="#group-${group.id}" data-group-anchor="${group.id}">
                  <span class="outline-index">${index + 1}</span>
                  <span class="outline-text">${escapeHtml(group.question || group.title)}</span>
                </a>
              `
            )
            .join("")}
        </nav>
      </header>
      <div class="workspace-scroll">
        <section class="group-list">
          ${state.document.groups.map((group) => groupCard(group)).join("")}
        </section>
      </div>
      <button class="floating-back-button" id="backToOutlineButton" type="button">Back to top</button>
    </main>
  `;

  bindEvents();
}

function feedback(message) {
  const node = document.getElementById("actionFeedback");
  if (node) node.textContent = message;
}

function bindEvents() {
  document.getElementById("docTitle").addEventListener("input", (event) => {
    state.document.title = event.target.value;
  });

  document.getElementById("loadThisPageButton").addEventListener("click", async () => {
    await refreshFromActiveTab();
  });

  document.getElementById("downloadMarkdownButton").addEventListener("click", () => {
    downloadMarkdownFile();
    feedback("Markdown file downloaded.");
  });

  document.getElementById("previewButton").addEventListener("click", async () => {
    await openPreviewTab();
    feedback("Opened preview in a new tab.");
  });

  document.getElementById("themeToggleButton").addEventListener("click", () => {
    state.preset.theme = state.preset.theme === "dark" ? "light" : "dark";
    render();
  });

  document.getElementById("backToOutlineButton").addEventListener("click", () => {
    const scrollHost = document.querySelector(".workspace-scroll");
    scrollHost?.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("outline-top")?.scrollIntoView({ block: "start" });
  });

  document.querySelectorAll("[data-action='toggle-group']").forEach((checkbox) => {
    checkbox.addEventListener("input", (event) => {
      const group = state.document.groups.find((item) => item.id === event.target.dataset.groupId);
      group.included = event.target.checked;
      event.target.closest(".group-card")?.classList.toggle("excluded", !group.included);
    });
  });

  document.querySelectorAll("[data-action='edit-title']").forEach((input) => {
    input.addEventListener("input", (event) => {
      const group = state.document.groups.find((item) => item.id === event.target.dataset.groupId);
      group.title = event.target.value;
    });
  });

  document.querySelectorAll("[data-action='edit-notes']").forEach((input) => {
    input.addEventListener("input", (event) => {
      const group = state.document.groups.find((item) => item.id === event.target.dataset.groupId);
      group.notes = event.target.value;
    });
  });

  document.querySelectorAll("[data-action='delete-group']").forEach((button) => {
    button.addEventListener("click", (event) => {
      state.document.groups = state.document.groups.filter((item) => item.id !== event.target.dataset.groupId);
      if (state.activeGroupId === event.target.dataset.groupId) {
        state.activeGroupId = state.document.groups[0]?.id || null;
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='delete-module']").forEach((button) => {
    button.addEventListener("click", (event) => {
      const group = state.document.groups.find((item) => item.id === event.target.dataset.groupId);
      group.modules = group.modules.filter((item) => item.id !== event.target.dataset.moduleId);
      render();
    });
  });

  setupOutlineTracking();
}

function updateOutlineHighlight(groupId) {
  state.activeGroupId = groupId;
  document.querySelectorAll("[data-group-anchor]").forEach((link) => {
    link.classList.toggle("active", link.dataset.groupAnchor === groupId);
  });
}

function setupOutlineTracking() {
  const scrollHost = document.querySelector(".workspace-scroll");
  const groupNodes = Array.from(document.querySelectorAll(".group-card"));

  if (!scrollHost || !groupNodes.length) return;

  const syncActiveGroup = () => {
    const hostTop = scrollHost.getBoundingClientRect().top;
    let bestId = groupNodes[0]?.dataset.groupId || null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const node of groupNodes) {
      const distance = Math.abs(node.getBoundingClientRect().top - hostTop - 24);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = node.dataset.groupId;
      }
    }

    if (bestId && bestId !== state.activeGroupId) {
      updateOutlineHighlight(bestId);
    }
  };

  scrollHost.addEventListener("scroll", syncActiveGroup, { passive: true });
  document.querySelectorAll("[data-group-anchor]").forEach((link) => {
    link.addEventListener("click", () => {
      const targetId = link.dataset.groupAnchor;
      if (targetId) updateOutlineHighlight(targetId);
    });
  });
  syncActiveGroup();
}

async function refreshFromActiveTab() {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    feedback("Chrome extension APIs are unavailable in this preview.");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    feedback("No active tab found.");
    return;
  }

  state.activeTabId = tab.id;
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: runtimeMessages.requestConversation });
  } catch (_error) {
    feedback("Could not reach a page parser in this tab. Open a ChatGPT or Qianwen conversation, then click Load This Page again.");
    return;
  }

  if (!response?.payload?.groups?.length) {
    feedback("No conversation data detected on this page. Seed content is still available.");
    return;
  }

  state.document = response.payload;
  if (!state.document.title) {
    state.document.title = state.preset.docTitle;
  }
  render();
  feedback(`Loaded ${state.document.groups.length} question-answer groups from the page.`);
}

render();
