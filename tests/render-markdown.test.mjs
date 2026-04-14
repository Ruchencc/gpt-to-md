import test from "node:test";
import assert from "node:assert/strict";

import { renderMarkdown } from "../src/shared/render-markdown.js";

test("renderMarkdown renders fenced code blocks without exposing the fences", () => {
  const html = renderMarkdown(["Before", "", "```js", "const value = 1 < 2;", "```", "", "After"].join("\n"));

  assert.match(html, /<p>Before<\/p>/);
  assert.match(html, /<div class="code-language-label">js<\/div>/);
  assert.match(html, /<pre><code class="language-js">const value = 1 &lt; 2;<\/code><\/pre>/);
  assert.match(html, /<p>After<\/p>/);
  assert.doesNotMatch(html, /```/);
});

test("renderMarkdown renders blockquotes and lists", () => {
  const html = renderMarkdown(["> quoted", "> still quoted", "", "- one", "- two", "", "1. first", "2. second"].join("\n"));

  assert.match(html, /<blockquote><p>quoted<\/p><p>still quoted<\/p><\/blockquote>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
});

test("renderMarkdown escapes raw html and preserves inline code", () => {
  const html = renderMarkdown("Use `<script>alert(1)</script>` safely.");

  assert.match(html, /<p>Use <code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code> safely\.<\/p>/);
  assert.doesNotMatch(html, /<script>/);
});

test("renderMarkdown renders fourth-level headings from markdown", () => {
  const html = renderMarkdown("#### Subheading");

  assert.match(html, /<h4>Subheading<\/h4>/);
});

test("renderMarkdown renders markdown headings produced by the adapters", () => {
  const html = renderMarkdown(["### Shell snippet", "", "Paragraph copy", "", "#### Nested detail"].join("\n"));

  assert.match(html, /<h3>Shell snippet<\/h3>/);
  assert.match(html, /<p>Paragraph copy<\/p>/);
  assert.match(html, /<h4>Nested detail<\/h4>/);
});

test("renderMarkdown renders markdown headings", () => {
  const html = renderMarkdown(["### Shell snippet", "", "Body copy"].join("\n"));

  assert.match(html, /<h3>Shell snippet<\/h3>/);
  assert.match(html, /<p>Body copy<\/p>/);
});

test("renderMarkdown renders markdown tables", () => {
  const html = renderMarkdown(["| Name | What |", "| --- | --- |", "| Gumroad | Creator commerce |", "| Etsy | Marketplace |"].join("\n"));

  assert.match(html, /<table>/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /<td>Gumroad<\/td>/);
  assert.match(html, /<td>Marketplace<\/td>/);
});
