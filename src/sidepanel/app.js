import { defaultPreset } from "../shared/default-preset.js";
import { getJumpScrollTop, getObservedScrollTop, shouldShowFloatingTools } from "../shared/floating-ui.js";
import { createInitialState } from "../shared/model.js";
import { exportMarkdown } from "../shared/export-markdown.js";
import { getGroupDisplayTitle } from "../shared/group-title.js";
import { runtimeMessages } from "../shared/messages.js";

const app = document.getElementById("app");
const PREVIEW_STORAGE_KEY = "chat-export-preview-document";
const EDITOR_STORAGE_KEY = "chat-to-md-editor-state";
const FLOATING_OUTLINE_THRESHOLD = 180;

const state = {
  preset: structuredClone(defaultPreset),
  document: createInitialState(),
  activeTabId: null,
  activeGroupId: null,
  floatingOutlineOpen: false,
  showFloatingOutline: false
};

let persistTimer = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function schedulePersist() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;

  if (persistTimer) clearTimeout(persistTimer);

  persistTimer = setTimeout(async () => {
    await chrome.storage.local.set({
      [EDITOR_STORAGE_KEY]: {
        theme: state.preset.theme,
        activeGroupId: state.activeGroupId,
        document: state.document
      }
    });
  }, 150);
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

function getScrollSnapshot() {
  const scrollHost = document.querySelector(".workspace-scroll");
  return {
    scrollTop: scrollHost?.scrollTop ?? 0,
    pageScrollTop: window.scrollY ?? document.documentElement?.scrollTop ?? document.body?.scrollTop ?? 0
  };
}

function restoreScrollSnapshot(snapshot) {
  if (!snapshot) return;

  requestAnimationFrame(() => {
    const scrollHost = document.querySelector(".workspace-scroll");
    if (scrollHost) {
      scrollHost.scrollTop = snapshot.scrollTop;
    }
    window.scrollTo({ top: snapshot.pageScrollTop, behavior: "auto" });
    updateFloatingOutlineVisibility(scrollHost);
  });
}

function renderOutlineItems(scope) {
  return state.document.groups
    .map(
      (group, index) => `
        <div
          class="outline-item ${state.activeGroupId === group.id ? "active" : ""}"
          data-outline-item
          data-group-anchor="${group.id}"
          data-outline-scope="${scope}"
        >
          <button
            class="outline-jump"
            type="button"
            data-action="jump-group"
            data-group-id="${group.id}"
            aria-label="Jump to ${escapeHtml(getGroupDisplayTitle(group))}"
          >
            <span class="outline-index">${index + 1}</span>
          </button>
          <input
            class="outline-title-input"
            type="text"
            value="${escapeHtml(getGroupDisplayTitle(group))}"
            data-action="edit-title"
            data-group-id="${group.id}"
          />
          <button
            class="outline-delete-button"
            type="button"
            data-action="delete-group"
            data-group-id="${group.id}"
            aria-label="Delete ${escapeHtml(getGroupDisplayTitle(group))}"
          >
            Delete
          </button>
        </div>
      `
    )
    .join("");
}

function groupCard(group) {
  return `
    <article class="group-card ${group.included ? "" : "excluded"}" data-group-id="${group.id}" id="group-${group.id}">
      <div class="group-card-header">
        <input class="checkbox" type="checkbox" ${group.included ? "checked" : ""} data-action="toggle-group" data-group-id="${group.id}" />
        <div>
          <input class="group-title-input" type="text" value="${escapeHtml(getGroupDisplayTitle(group))}" data-action="edit-title" data-group-id="${group.id}" />
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
                <textarea
                  class="module-editor"
                  data-action="edit-module-content"
                  data-group-id="${group.id}"
                  data-module-id="${module.id}"
                  spellcheck="false"
                >${escapeHtml(module.content || "")}</textarea>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderFloatingOutline() {
  return `
    <div class="floating-outline-shell ${state.showFloatingOutline ? "visible" : ""} ${state.floatingOutlineOpen ? "open" : ""}" id="floatingOutlineShell">
      <button class="floating-back-button" id="backToOutlineButton" type="button">Back to top</button>
      <button class="floating-outline-launcher" id="floatingOutlineToggleButton" type="button">
        ${state.floatingOutlineOpen ? "Close" : "Outline"}
      </button>
      <section class="floating-outline-panel" aria-label="Quick conversation outline">
        <div class="floating-outline-panel-header">
          <span>Quick outline</span>
          <button class="ghost-button" id="floatingOutlineTopButton" type="button">Top</button>
        </div>
        <nav class="outline-nav floating-outline-nav" aria-label="Floating conversation outline">
          ${renderOutlineItems("floating")}
        </nav>
      </section>
    </div>
  `;
}

function render(options = {}) {
  const snapshot = options.preserveScroll ? getScrollSnapshot() : null;

  applyPreset();

  if (!state.activeGroupId && state.document.groups.length) {
    state.activeGroupId = state.document.groups[0].id;
  }

  if (!state.document.groups.length) {
    state.activeGroupId = null;
    state.floatingOutlineOpen = false;
    state.showFloatingOutline = false;
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
          ${renderOutlineItems("top")}
        </nav>
      </header>
      <div class="workspace-scroll">
        <section class="group-list">
          ${state.document.groups.map((group) => groupCard(group)).join("")}
        </section>
      </div>
      ${renderFloatingOutline()}
    </main>
  `;

  bindEvents();
  restoreScrollSnapshot(snapshot);
}

function feedback(message) {
  const node = document.getElementById("actionFeedback");
  if (node) node.textContent = message;
}

function syncGroupTitleInputs(groupId, value, source) {
  document.querySelectorAll(`[data-action="edit-title"][data-group-id="${groupId}"]`).forEach((input) => {
    if (input !== source) input.value = value;
  });
}

function updateGroupTitle(groupId, value, source) {
  const group = state.document.groups.find((item) => item.id === groupId);
  if (!group) return;
  group.title = value;
  syncGroupTitleInputs(groupId, value, source);
  schedulePersist();
}

function updateOutlineHighlight(groupId) {
  state.activeGroupId = groupId;
  document.querySelectorAll("[data-outline-item]").forEach((item) => {
    item.classList.toggle("active", item.dataset.groupAnchor === groupId);
  });
}

function jumpToTop() {
  const scrollHost = document.querySelector(".workspace-scroll");
  scrollHost?.scrollTo({ top: 0, behavior: "smooth" });
  window.scrollTo({ top: 0, behavior: "smooth" });
  state.floatingOutlineOpen = false;
  updateFloatingOutlineShell();
}

function jumpToGroup(groupId) {
  const scrollHost = document.querySelector(".workspace-scroll");
  const target = document.getElementById(`group-${groupId}`);
  if (!target) return;

  if (scrollHost) {
    const top = getJumpScrollTop({
      hostTop: scrollHost.getBoundingClientRect().top,
      targetTop: target.getBoundingClientRect().top,
      currentScrollTop: scrollHost.scrollTop
    });
    scrollHost.scrollTo({ top, behavior: "smooth" });
  }

  const pageTop = window.scrollY + target.getBoundingClientRect().top - 8;
  window.scrollTo({ top: Math.max(0, pageTop), behavior: "smooth" });
  updateOutlineHighlight(groupId);
  schedulePersist();
}

function updateFloatingOutlineShell() {
  const shell = document.getElementById("floatingOutlineShell");
  const launcher = document.getElementById("floatingOutlineToggleButton");

  if (!shell || !launcher) return;

  shell.classList.toggle("visible", state.showFloatingOutline);
  shell.classList.toggle("open", state.floatingOutlineOpen);
  launcher.textContent = state.floatingOutlineOpen ? "Close" : "Outline";
}

function updateFloatingOutlineVisibility(scrollHost = document.querySelector(".workspace-scroll")) {
  const nextVisible = shouldShowFloatingTools(
    getObservedScrollTop(
      scrollHost?.scrollTop,
      window.scrollY,
      document.documentElement?.scrollTop,
      document.body?.scrollTop
    ),
    state.document.groups.length,
    FLOATING_OUTLINE_THRESHOLD
  );
  if (state.showFloatingOutline === nextVisible) return;

  state.showFloatingOutline = nextVisible;
  if (!nextVisible) {
    state.floatingOutlineOpen = false;
  }
  updateFloatingOutlineShell();
}

function deleteGroup(groupId, options = {}) {
  state.document.groups = state.document.groups.filter((item) => item.id !== groupId);
  if (state.activeGroupId === groupId) {
    state.activeGroupId = state.document.groups[0]?.id || null;
  }
  schedulePersist();
  render({ preserveScroll: options.preserveScroll ?? true });
}

function deleteModule(groupId, moduleId) {
  const group = state.document.groups.find((item) => item.id === groupId);
  if (!group) return;
  group.modules = group.modules.filter((item) => item.id !== moduleId);
  schedulePersist();
  render({ preserveScroll: true });
}

function bindEvents() {
  document.getElementById("docTitle").addEventListener("input", (event) => {
    state.document.title = event.target.value;
    schedulePersist();
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
    schedulePersist();
    render({ preserveScroll: true });
  });

  document.getElementById("backToOutlineButton")?.addEventListener("click", () => {
    jumpToTop();
  });

  document.getElementById("floatingOutlineToggleButton")?.addEventListener("click", () => {
    state.floatingOutlineOpen = !state.floatingOutlineOpen;
    updateFloatingOutlineShell();
  });

  document.getElementById("floatingOutlineTopButton")?.addEventListener("click", () => {
    jumpToTop();
  });

  document.querySelectorAll("[data-action='toggle-group']").forEach((checkbox) => {
    checkbox.addEventListener("input", (event) => {
      const group = state.document.groups.find((item) => item.id === event.target.dataset.groupId);
      if (!group) return;
      group.included = event.target.checked;
      event.target.closest(".group-card")?.classList.toggle("excluded", !group.included);
      schedulePersist();
    });
  });

  document.querySelectorAll("[data-action='edit-title']").forEach((input) => {
    input.addEventListener("input", (event) => {
      updateGroupTitle(event.target.dataset.groupId, event.target.value, event.target);
    });
  });

  document.querySelectorAll("[data-action='edit-notes']").forEach((input) => {
    input.addEventListener("input", (event) => {
      const group = state.document.groups.find((item) => item.id === event.target.dataset.groupId);
      if (!group) return;
      group.notes = event.target.value;
      schedulePersist();
    });
  });

  document.querySelectorAll("[data-action='edit-module-content']").forEach((input) => {
    input.addEventListener("input", (event) => {
      const group = state.document.groups.find((item) => item.id === event.target.dataset.groupId);
      const module = group?.modules.find((item) => item.id === event.target.dataset.moduleId);
      if (!module) return;
      module.content = event.target.value;
      schedulePersist();
    });
  });

  document.querySelectorAll("[data-action='delete-group']").forEach((button) => {
    button.addEventListener("click", (event) => {
      deleteGroup(event.currentTarget.dataset.groupId);
    });
  });

  document.querySelectorAll("[data-action='delete-module']").forEach((button) => {
    button.addEventListener("click", (event) => {
      deleteModule(event.currentTarget.dataset.groupId, event.currentTarget.dataset.moduleId);
    });
  });

  document.querySelectorAll("[data-action='jump-group']").forEach((button) => {
    button.addEventListener("click", (event) => {
      jumpToGroup(event.currentTarget.dataset.groupId);
    });
  });

  document.querySelectorAll("[data-outline-item]").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest("input, button")) return;
      jumpToGroup(item.dataset.groupAnchor);
    });
  });

  setupOutlineTracking();
}

function setupOutlineTracking() {
  const scrollHost = document.querySelector(".workspace-scroll");
  const groupNodes = Array.from(document.querySelectorAll(".group-card"));

  if (!scrollHost || !groupNodes.length) {
    updateFloatingOutlineVisibility(scrollHost);
    return;
  }

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
      schedulePersist();
    }

    updateFloatingOutlineVisibility(scrollHost);
  };

  scrollHost.addEventListener("scroll", syncActiveGroup, { passive: true });
  window.addEventListener("scroll", syncActiveGroup, { passive: true });
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
  state.activeGroupId = state.document.groups[0]?.id || null;
  state.floatingOutlineOpen = false;
  schedulePersist();
  render();
  feedback(`Loaded ${state.document.groups.length} question-answer groups from the page.`);
}

async function restoreEditorState() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;

  const stored = await chrome.storage.local.get(EDITOR_STORAGE_KEY);
  const payload = stored[EDITOR_STORAGE_KEY];
  if (!payload?.document) return;

  state.document = payload.document;
  state.activeGroupId = payload.activeGroupId || payload.document.groups?.[0]?.id || null;
  if (payload.theme) {
    state.preset.theme = payload.theme;
  }
}

async function boot() {
  await restoreEditorState();
  render();
}

boot();
