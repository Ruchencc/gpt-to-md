# chat-to-md

Local-only Chrome MV3 extension for curating one ChatGPT or Qianwen conversation into Markdown.
———— 千问的部分还没测试过，gpt的确认可用，欢迎大家多多使用

## Load Unpacked

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the `extension/` directory

## Try It

1. Open a conversation on `chatgpt.com`, `chat.openai.com`, or `www.qianwen.com/chat`
2. Click the extension action to open the side panel
3. Click `Refresh From Page`
4. Edit group titles, notes, and block selection
5. Click `Copy Markdown`

## Test

Run:

```bash
node --test extension/tests/export-markdown.test.mjs
```
