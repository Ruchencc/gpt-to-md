export function createSeedDocument() {
  return {
    source: {
      site: "seed",
      label: "Seed preview",
      url: ""
    },
    title: "AI 产品研究笔记 / Writing Systems / Prompt Editing",
    groups: [
      {
        id: "g1",
        included: true,
        title: "为什么 product teams 还是很难复用 AI 对话",
        notes:
          "Keep this group. 它把核心痛点讲得很清楚，也有足够的 opening language 可以直接放进最终文档。",
        question:
          "我有很多长篇 AI chats。Why do people still fail to turn them into 可复用的 notes afterwards?",
        modules: [
          {
            id: "m1",
            title: "Response",
            content: [
              "Most conversations fail at the handoff stage. 当下看起来很有帮助的回答，往往并不是为了 later retrieval、快速扫描或二次整理而写的。",
              "",
              "- No stable 文档标题 or file name",
              "- Topics 之间的 section boundary 太弱",
              "- Follow-up turns 把最好的 insight 埋掉了",
              "- Formatting 更适合 chat，不适合 later reference",
              "",
              "> The core issue is not lack of information. 真正缺的是 editorial structure。"
            ].join("\n")
          }
        ]
      },
      {
        id: "g2",
        included: true,
        title: "Selective export workflow 的 UI 应该长什么样",
        notes:
          "This section should stay, 但如果最终文档不想太 technical，我可能会删掉下面这段 type 定义。",
        question:
          "如果我只想 curate one conversation，并且在导出前做清理，一个 browser extension 最少需要什么？",
        modules: [
          {
            id: "m2",
            title: "Interaction model",
            content:
              "The editing model should work on grouped question-answer pairs, not isolated messages. 这样文档的 narrative spine 会更稳。"
          },
          {
            id: "m3",
            title: "Data shape",
            content: [
              "```",
              "type ExportGroup = {",
              "  id: string;",
              "  included: boolean;",
              "  title: string;",
              "  notes: string;",
              "  modules: Array<ExportModule>;",
              "};",
              "```",
              "",
              "A split interface works well: 左边 cards 用来编辑，右边放 rendered preview，再加一个小型 parameter lab 专门调节视觉参数。"
            ].join("\n")
          }
        ]
      }
    ]
  };
}

export function createInitialState() {
  return createSeedDocument();
}
