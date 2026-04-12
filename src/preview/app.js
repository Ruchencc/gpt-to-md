const PREVIEW_STORAGE_KEY = "chat-export-preview-document";

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
  const parts = [];
  if (module.title && module.title !== "Response") {
    parts.push(`<h3>${escapeHtml(module.title)}</h3>`);
  }
  parts.push(...module.blocks.map((block) => renderBlockBody(block)));
  return parts.join("");
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
              <h2>${escapeHtml(group.title)}</h2>
              ${group.notes.trim() ? `<div class="notes">${escapeHtml(group.notes)}</div>` : ""}
              <div class="question-label">Question</div>
              <p>${escapeHtml(group.question)}</p>
              <div class="answer-label">Answer</div>
              ${group.modules.map((module) => renderModuleBody(module)).join("")}
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
