export function getGroupDisplayTitle(group) {
  return String(group?.title || "").trim() || String(group?.question || "").trim() || "Untitled section";
}
