import pyaudio

class AudioIO:
    def __init__(self, input_rate=16000, output_rate=24000, chunk_ms=20):
        self.input_rate = input_rate
        self.output_rate = output_rate
        self.chunk_ms = chunk_ms
        self.chunk_samples = int(self.input_rate * self.chunk_ms / 1000)
        self.pa = pyaudio.PyAudio()
        self.out_stream = self.pa.open(format=pyaudio.paInt16, channels=1, rate=self.output_rate, output=True, frames_per_buffer=1024, start=False)
        self.in_stream = self.pa.open(format=pyaudio.paInt16, channels=1, rate=self.input_rate, input=True, frames_per_buffer=self.chunk_samples)

    def read_chunk(self):
        return self.in_stream.read(self.chunk_samples, exception_on_overflow=False)

    def start_output(self):
        if not self.out_stream.is_active():
            try:
                self.out_stream.start_stream()
            except:
                pass

    def stop_output(self):
        if self.out_stream.is_active():
            try:
                self.out_stream.stop_stream()
            except:
                pass

    def write_output(self, b: bytes):
        if not self.out_stream.is_active():
            self.start_output()
        try:
            self.out_stream.write(b)
        except:
            pass

    def close(self):
        try:
            self.in_stream.stop_stream(); self.in_stream.close()
        except: pass
        try:
            if self.out_stream.is_active(): self.out_stream.stop_stream()
            self.out_stream.close()
        except: pass
        try:
            self.pa.terminate()
        except: pass
