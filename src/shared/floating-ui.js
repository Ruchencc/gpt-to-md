export function shouldShowFloatingTools(scrollTop, groupCount, threshold = 180) {
  return groupCount > 0 && scrollTop > threshold;
}

export function getObservedScrollTop(...values) {
  return Math.max(
    0,
    ...values.map((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    })
  );
}

export function getJumpScrollTop({ hostTop, targetTop, currentScrollTop, offset = 8 }) {
  return Math.max(0, currentScrollTop + (targetTop - hostTop) - offset);
}
