import { getGroupDisplayTitle } from "../shared/group-title.js";

const PREVIEW_STORAGE_KEY = "chat-export-preview-document";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarkdownLike(content) {
  const escaped = escapeHtml(content);
  return `<pre><code>${escaped}</code></pre>`;
}

function previewMarkup(documentModel) {
  return `
    <article class="preview-doc preview-doc-standalone">
      <h1>${escapeHtml(documentModel.title)}</h1>
      ${documentModel.groups
        .filter((group) => group.included)
        .map(
          (group) => `
            <section>
              <h2>${escapeHtml(getGroupDisplayTitle(group))}</h2>
              ${group.notes.trim() ? `<div class="notes">${escapeHtml(group.notes)}</div>` : ""}
              <div class="question-label">Question</div>
              <p>${escapeHtml(group.question)}</p>
              <div class="answer-label">Answer</div>
              ${group.modules
                .map(
                  (module) => `
                    ${module.title && module.title !== "Response" ? `<h3>${escapeHtml(module.title)}</h3>` : ""}
                    ${renderMarkdownLike(module.content || "")}
                  `
                )
                .join("")}
            </section>
          `
        )
        .join("")}
      <div class="preview-footer">
        ${escapeHtml(documentModel.source?.label || "")} ${escapeHtml(documentModel.source?.url || "")}
      </div>
    </article>
  `;
}

async function boot() {
  const root = document.getElementById("previewRoot");
  const stored = await chrome.storage.local.get(PREVIEW_STORAGE_KEY);
  const payload = stored[PREVIEW_STORAGE_KEY];

  if (!payload?.document) {
    root.innerHTML = `
      <article class="preview-doc preview-doc-standalone">
        <p>No preview payload found yet. Go back to the side panel and click Preview again.</p>
      </article>
    `;
    return;
  }

  document.documentElement.dataset.theme = payload.theme || "dark";
  root.innerHTML = previewMarkup(payload.document);
}

boot();
