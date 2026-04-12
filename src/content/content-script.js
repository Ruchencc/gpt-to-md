function extractConversation() {
  const host = window.location.hostname;

  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
    return globalThis.chatExportChatGptAdapter?.extractChatGptConversation(document) || null;
  }

  if (host.includes("qianwen.com")) {
    return globalThis.chatExportQianwenAdapter?.extractQianwenConversation(document) || null;
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "chat-export/request-conversation") return false;

  sendResponse({
    type: "chat-export/conversation-payload",
    payload: extractConversation()
  });

  return true;
});
