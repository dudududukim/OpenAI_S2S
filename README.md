# 1. webRTC based S2S

[OpenAI Voice Agents Quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/)

webRTC based OpenAI realtime api should be written on JS type.

```bash

```

```text
[브라우저]  --(HTTPS)-->  [내 서버] --(API Key)--> [OpenAI /v1/realtime/sessions]
                         (OpenAI API Key는 서버에만 있음)
[내 서버] <-- ephemeral key -- [OpenAI]
[브라우저] <-- ephemeral key -- [내 서버]
[브라우저] --(ephemeral key, WebRTC)--> [OpenAI Realtime API]
```