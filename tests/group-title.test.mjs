import test from "node:test";
import assert from "node:assert/strict";

import { getGroupDisplayTitle } from "../src/shared/group-title.js";

test("getGroupDisplayTitle prefers edited titles and falls back to question text", () => {
  assert.equal(
    getGroupDisplayTitle({
      title: "自定义标题",
      question: "原始问题"
    }),
    "自定义标题"
  );

  assert.equal(
    getGroupDisplayTitle({
      title: "   ",
      question: "原始问题"
    }),
    "原始问题"
  );
});
