import asyncio
import time
from audio_stream import AudioStream
from realtime_client import RealtimeClient

class VoiceAgent:
    def __init__(self):
        self.client = RealtimeClient()
        self.audio = AudioStream()
        self.response_text = ""
        self.last_commit_time = 0
        
    async def start(self):
        await self.client.connect()
        self.audio.start_recording()
        self.audio.start_playback()
        
        print("음성 에이전트가 시작되었습니다. 말씀해 주세요...")
        
        await asyncio.gather(
            self.handle_input(),
            self.handle_output()
        )
        
    async def handle_input(self):
        audio_buffer = []
        
        while self.client.connected:
            audio_data = self.audio.get_audio_data()
            if audio_data:
                audio_buffer.append(audio_data)
                
                await self.client.send({
                    "type": "input_audio_buffer.append",
                    "audio": audio_data
                })
                
                current_time = time.time()
                if current_time - self.last_commit_time > 2.0 and len(audio_buffer) > 10:
                    await self.client.send({"type": "input_audio_buffer.commit"})
                    await self.client.send({
                        "type": "response.create",
                        "response": {"modalities": ["text", "audio"]}
                    })
                    audio_buffer.clear()
                    self.last_commit_time = current_time
                    
            await asyncio.sleep(0.05)
            
    async def handle_output(self):
        while self.client.connected:
            event = await self.client.receive()
            if not event:
                break
                
            event_type = event.get("type")
            
            if event_type == "response.audio.delta":
                delta = event.get("delta")
                if delta:
                    self.audio.add_audio_data(delta)
                    
            elif event_type == "conversation.item.input_audio_transcription.completed":
                transcript = event.get("transcript", "").strip()
                if transcript:
                    print(f"사용자: {transcript}")
                    
            elif event_type == "response.audio_transcript.delta":
                delta = event.get("delta", "")
                if delta:
                    if not self.response_text:
                        print("AI: ", end="", flush=True)
                    self.response_text += delta
                    print(delta, end="", flush=True)
                    
            elif event_type == "response.done":
                if self.response_text:
                    print()
                    self.response_text = ""
                
    async def stop(self):
        self.audio.stop()
        await self.client.close()

async def main():
    agent = VoiceAgent()
    try:
        await agent.start()
    except KeyboardInterrupt:
        print("\n종료합니다")
        await agent.stop()

if __name__ == "__main__":
    asyncio.run(main())
