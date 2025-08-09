import pyaudio
import base64
import threading
from queue import Queue

class AudioStream:
    def __init__(self, sample_rate=24000, chunk_size=1024):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.audio = pyaudio.PyAudio()
        self.input_queue = Queue()
        self.output_queue = Queue()
        self.recording = False
        self.playing = False
        
    def start_recording(self):
        stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.chunk_size
        )
        
        self.recording = True
        
        def record():
            while self.recording:
                data = stream.read(self.chunk_size, exception_on_overflow=False)
                encoded = base64.b64encode(data).decode()
                self.input_queue.put(encoded)
                
        threading.Thread(target=record, daemon=True).start()
        
    def start_playback(self):
        stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            output=True,
            frames_per_buffer=self.chunk_size
        )
        
        self.playing = True
        
        def play():
            while self.playing:
                if not self.output_queue.empty():
                    data = self.output_queue.get()
                    decoded = base64.b64decode(data)
                    stream.write(decoded)
                    
        threading.Thread(target=play, daemon=True).start()
        
    def get_audio_data(self):
        return self.input_queue.get() if not self.input_queue.empty() else None
        
    def add_audio_data(self, data):
        self.output_queue.put(data)
        
    def stop(self):
        self.recording = False
        self.playing = False
        self.audio.terminate()
