import threading, queue

class AudioPlayer:
    def __init__(self, audio_io):
        self.audio_io = audio_io
        self.q = queue.Queue(maxsize=64)
        self.running = False
        self.muted = False
        self.thread = None

    def start(self):
        if self.running: return
        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def _loop(self):
        while self.running:
            try:
                item = self.q.get(timeout=0.1)
            except queue.Empty:
                continue
            if item is None: break
            if self.muted: continue
            self.audio_io.start_output()
            self.audio_io.write_output(item)

    def enqueue(self, b: bytes):
        try:
            self.q.put_nowait(b)
        except queue.Full:
            try: self.q.get_nowait()
            except: pass
            try: self.q.put_nowait(b)
            except: pass

    def clear(self):
        try:
            while True: self.q.get_nowait()
        except: pass

    def mute(self):
        self.muted = True

    def unmute(self):
        self.muted = False

    def stop(self):
        self.running = False
        try: self.q.put_nowait(None)
        except: pass
        try:
            if self.thread: self.thread.join(timeout=1.0)
        except: pass
        self.audio_io.stop_output()
