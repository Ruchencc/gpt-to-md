function renderBlock(block) {
  if (block.type === "paragraph") {
    return `${block.text}\n`;
  }

  if (block.type === "list") {
    return block.items.map((item) => `- ${item}`).join("\n");
  }

  if (block.type === "quote") {
    return block.text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (block.type === "code") {
    return `\`\`\`\n${block.code}\n\`\`\``;
  }

  return "";
}

function renderModule(module) {
  const lines = [];

  if (module.title && module.title !== "Response") {
    lines.push(`### ${module.title}`);
  }

  lines.push(...module.blocks.map((block) => renderBlock(block)).filter(Boolean));
  return lines.join("\n\n");
}

export function exportMarkdown(documentModel) {
  const sections = [`# ${documentModel.title}`];

  for (const group of documentModel.groups) {
    if (!group.included) continue;

    sections.push(`## ${group.title}`);

    if (group.notes.trim()) {
      sections.push(`_Notes:_ ${group.notes}`);
    }

    sections.push(`**Question**\n${group.question}`);
    sections.push(
      [
        "**Answer**",
        ...group.modules.map((module) => renderModule(module))
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  if (documentModel.source?.url) {
    sections.push(`Source: ${documentModel.source.site} ${documentModel.source.url}`);
  }

  return sections.join("\n\n").trim() + "\n";
}
