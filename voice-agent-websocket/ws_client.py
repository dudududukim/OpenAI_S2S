import os, json, base64, threading, signal, sys, time
from dotenv import load_dotenv
import websocket

def b64enc_pcm16(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")

def b64dec(data: str) -> bytes:
    return base64.b64decode(data)

class RealtimeWSClient:
    def __init__(self, audio_io, player):
        load_dotenv()
        self.API_KEY = os.getenv("OPENAI_API_KEY")
        self.MODEL = os.getenv("MODEL", "gpt-4o-realtime-preview")
        self.VOICE = os.getenv("VOICE", "verse")
        self.SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are a concise voice assistant. Keep answers short.")
        self.audio_io = audio_io
        self.player = player
        self.ws_app = None
        self.connected = False
        self._send_lock = threading.Lock()
        self.server_vad_threshold = float(os.getenv("SERVER_VAD_THRESHOLD", "0.65"))
        self.server_vad_silence_ms = int(os.getenv("SERVER_VAD_SILENCE_MS", "400"))
        self.server_vad_prefix_ms = int(os.getenv("SERVER_VAD_PREFIX_MS", "300"))

        self._append_count = 0
        self.log_append_every_n = int(os.getenv("APPEND_LOG_EVERY_N", "50"))


    def send_safe(self, payload: dict):
        if not self.connected:
            return
        try:
            with self._send_lock:
                if not self.connected:
                    return
                self.ws_app.send(json.dumps(payload))
        except Exception as e:
            print(f"[client] send error: {e}")
            return

        etype = payload.get("type", "")
        if etype == "input_audio_buffer.append":
            self._append_count += 1
            if self.log_append_every_n > 0 and (self._append_count % self.log_append_every_n) == 0:
                print(f"[client] sent {etype} x{self._append_count}")
            return

        print(f"[client] sent {etype}")

    def on_open(self, ws):
        self.connected = True
        msg = {
            "type": "session.update",
            "session": {
                "instructions": self.SYSTEM_PROMPT,
                "voice": self.VOICE,
                "modalities": ["audio", "text"],
                "input_audio_format": {"type": "pcm16", "sample_rate_hz": self.audio_io.input_rate},
                "output_audio_format": {"type": "pcm16", "sample_rate_hz": self.audio_io.output_rate},
                "turn_detection": {
                    "type": "server_vad",
                    "silence_duration_ms": self.server_vad_silence_ms,
                    "prefix_padding_ms": self.server_vad_prefix_ms,
                    "threshold": self.server_vad_threshold,
                    "create_response": False,
                    "interrupt_response": False
                }
            },
        }
        self.send_safe(msg)
        print("[client] sent session.update")

        def mic_loop():
            while self.connected:
                try:
                    data = self.audio_io.read_chunk()
                    self.send_safe({"type": "input_audio_buffer.append", "audio": b64enc_pcm16(data)})
                except:
                    time.sleep(0.005)
                    continue
        threading.Thread(target=mic_loop, daemon=True).start()
        self.player.start()
        print("[client] mic streaming...")

    def on_message(self, ws, message):
        try:
            ev = json.loads(message)
            t = ev.get("type", "")

            if t == "input_audio_buffer.speech_stopped":
                self.send_safe({"type": "response.create", "response": {"modalities": ["audio", "text"], "voice": self.VOICE}})
                print("[server] input_audio_buffer.speech_stopped -> response.create")
                return

            if t == "response.audio.delta":
                delta = ev.get("delta", "")
                if delta:
                    self.player.enqueue(b64dec(delta))
                return

            if t == "response.audio_transcript.delta":
                delta = ev.get("delta", "")
                if delta:
                    print(delta, end="", flush=True)
                return

            if t == "response.audio_transcript.done":
                print()
                return

            if t in ("response.audio.done", "response.done"):
                print(f"[server] {t}")
                return

            if t in ("session.created", "response.created", "rate_limits.updated", "conversation.item.created", "response.content_part.added", "response.content_part.done", "response.output_item.done"):
                print(f"[server] {t}")
                return

        except Exception as e:
            print(f"[client] on_message error: {e}")

    def on_error(self, ws, error):
        print(f"[client] ws error: {error}")

    def on_close(self, ws, code, reason):
        self.connected = False
        print(f"[client] ws closed: {code} {reason}")

    def run(self):
        websocket.enableTrace(False)
        headers = [
            f"Authorization: Bearer {self.API_KEY}",
            "OpenAI-Beta: realtime=v1",
        ]
        url = f"wss://api.openai.com/v1/realtime?model={self.MODEL}"
        self.ws_app = websocket.WebSocketApp(
            url,
            header=headers,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
        )
        def sigint_handler(sig, frame):
            self.connected = False
            try: self.player.stop()
            except: pass
            try: self.audio_io.close()
            except: pass
            try: self.ws_app.close()
            except: pass
            print("\n[client] terminated")
            sys.exit(0)
        signal.signal(signal.SIGINT, sigint_handler)
        self.ws_app.run_forever(ping_interval=20, ping_timeout=10)
