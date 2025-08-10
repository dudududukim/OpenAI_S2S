from dotenv import load_dotenv
from audio_io import AudioIO
from player import AudioPlayer
from ws_client import RealtimeWSClient

def main():
    load_dotenv()
    audio = AudioIO(input_rate=16000, output_rate=24000, chunk_ms=20)
    player = AudioPlayer(audio)
    client = RealtimeWSClient(audio, player)
    client.run()

if __name__ == "__main__":
    main()
