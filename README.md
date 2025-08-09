## 📝 Recent Commits

## 📝 Recent Commits

<!-- COMMITS:START -->

| Hash | Message | Author | Date |
|------|---------|--------|------|
| [`0a9c865`](https://github.com/dudududukim/OpenAI_S2S/commit/0a9c865) | feat: auto-update README with commit log | Duhyeon | 2025-08-09 |
| [`
fdcdeff`](https://github.com/dudududukim/OpenAI_S2S/commit/
fdcdeff) | feat: auto-update README with commit log | Duhyeon | 2025-08-09 |
| [`
5b7ddc7`](https://github.com/dudududukim/OpenAI_S2S/commit/
5b7ddc7) | fix: readme (webrtc + websocket bash) | Duhyeon | 2025-08-09 |
| [`
68b39b0`](https://github.com/dudududukim/OpenAI_S2S/commit/
68b39b0) | feat: add OpenAI S2S voice agents (WebSocket &amp; WebRTC) | Duhyeon | 2025-08-09 |

*Last updated: 2025-08-09 10:58:03 UTC*

<!-- COMMITS:END -->


# 1. webRTC based S2S

[OpenAI Voice Agents Quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/)

webRTC based OpenAI realtime api should be written on JS type.

```bash
npm install
echo "OPENAI_API_KEY=your_api_key_here" > .env
npm run server
npm run dev
```

```text
[브라우저]  --(HTTPS)-->  [내 서버] --(API Key)--> [OpenAI /v1/realtime/sessions]
                         (OpenAI API Key는 서버에만 있음)
[내 서버] <-- ephemeral key -- [OpenAI]
[브라우저] <-- ephemeral key -- [내 서버]
[브라우저] --(ephemeral key, WebRTC)--> [OpenAI Realtime API]
```

# 2. webSocket based S2S

```text
[Python Client] --(WebSocket, API Key)--> [OpenAI Realtime API]
     ↑↓
[Audio I/O (PyAudio)]
```

Setup

```bash
# with venv
pip install -r requirements.txt

echo "OPENAI_API_KEY=your_api_key_here" > .env

python main.py
```