import test from "node:test";
import assert from "node:assert/strict";

import { getJumpScrollTop, getObservedScrollTop, shouldShowFloatingTools } from "../src/shared/floating-ui.js";

test("shouldShowFloatingTools only appears after scrolling past the threshold with groups", () => {
  assert.equal(shouldShowFloatingTools(100, 3), false);
  assert.equal(shouldShowFloatingTools(220, 0), false);
  assert.equal(shouldShowFloatingTools(220, 3), true);
});

test("getJumpScrollTop computes a scroll-host relative target position", () => {
  assert.equal(
    getJumpScrollTop({
      hostTop: 120,
      targetTop: 520,
      currentScrollTop: 300
    }),
    692
  );
});

test("getObservedScrollTop falls back to the highest available scroll source", () => {
  assert.equal(getObservedScrollTop(undefined, null, 0), 0);
  assert.equal(getObservedScrollTop(0, 240, 36), 240);
});
