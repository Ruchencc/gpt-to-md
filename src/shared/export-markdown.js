import { getGroupDisplayTitle } from "./group-title.js";

function renderModule(module) {
  const lines = [];

  if (module.title && module.title !== "Response") {
    lines.push(`### ${module.title}`);
  }

  lines.push(module.content.trim());
  return lines.filter(Boolean).join("\n\n");
}

export function exportMarkdown(documentModel) {
  const sections = [`# ${documentModel.title}`];

  for (const group of documentModel.groups) {
    if (!group.included) continue;

    sections.push(`## ${getGroupDisplayTitle(group)}`);

    if (group.notes.trim()) {
      sections.push(`_Notes:_ ${group.notes}`);
    }

    sections.push(`**Question**\n${group.question}`);
    sections.push(
      ["**Answer**", ...group.modules.map((module) => renderModule(module))]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  if (documentModel.source?.url) {
    sections.push(`Source: ${documentModel.source.site} ${documentModel.source.url}`);
  }

  return sections.join("\n\n").trim() + "\n";
}
