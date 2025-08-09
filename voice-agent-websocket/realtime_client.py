import websockets
import json
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

class RealtimeClient:
    def __init__(self):
        self.ws = None
        self.connected = False
        self.api_key = os.getenv("OPENAI_API_KEY")
        
    async def connect(self):
        url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1"
        }
        
        self.ws = await websockets.connect(url, additional_headers=headers)
        self.connected = True
        
        await self.send({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": "You are a helpful voice assistant. Respond naturally in Korean. Keep responses brief and relevant.",
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": None,
                "temperature": 0.7
            }
        })
        
    async def send(self, event):
        if self.ws and self.connected:
            await self.ws.send(json.dumps(event))
            
    async def receive(self):
        if self.ws and self.connected:
            try:
                message = await self.ws.recv()
                return json.loads(message)
            except websockets.exceptions.ConnectionClosed:
                self.connected = False
        return None
        
    async def close(self):
        if self.ws:
            await self.ws.close()
            self.connected = False
