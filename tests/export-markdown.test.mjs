import test from "node:test";
import assert from "node:assert/strict";

import { exportMarkdown } from "../src/shared/export-markdown.js";

test("exportMarkdown renders included groups and h2-level modules", () => {
  const markdown = exportMarkdown({
    title: "Doc title",
    source: { site: "chatgpt", url: "https://chatgpt.com/c/example" },
    groups: [
      {
        included: true,
        title: "Included section",
        notes: "Keep this context",
        question: "What should stay?",
        modules: [
          {
            title: "First module",
            blocks: [
              { type: "paragraph", text: "A kept paragraph." },
              { type: "list", items: ["One", "Two"] }
            ]
          },
          {
            title: "Second module",
            blocks: [
              { type: "quote", text: "Quoted line" },
              { type: "code", code: "const value = 1;" }
            ]
          }
        ]
      },
      {
        included: false,
        title: "Hidden section",
        notes: "",
        question: "Should not appear",
        modules: [{ title: "Response", blocks: [{ type: "paragraph", text: "Nope" }] }]
      }
    ]
  });

  assert.match(markdown, /^# Doc title/m);
  assert.match(markdown, /^## Included section/m);
  assert.match(markdown, /_Notes:_ Keep this context/);
  assert.match(markdown, /\*\*Question\*\*\nWhat should stay\?/);
  assert.match(markdown, /^### First module/m);
  assert.match(markdown, /- One\n- Two/);
  assert.match(markdown, /^### Second module/m);
  assert.match(markdown, /> Quoted line/);
  assert.match(markdown, /```[\s\S]*const value = 1;[\s\S]*```/);
  assert.doesNotMatch(markdown, /Hidden section/);
});
