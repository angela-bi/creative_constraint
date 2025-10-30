import numpy as np
import sounddevice as sd
import time
import json

OUTPUT_PATH = "/tmp/soundlevel.json"
from scipy.io.wavfile import write

CHUNK = 1024

fs = 44100  # Sample rate
seconds = 3  # Duration of recording

myrecording = sd.rec(frames=seconds*fs, samplerate=fs, channels=1, dtype='int16')
print(myrecording)
# sound_level = float(np.sqrt(np.mean(myrecording**2)))
sd.wait()
write("sound.wav",fs,myrecording)

# with open(OUTPUT_PATH, "w") as f:
#     json.dump({"level": sound_level}, f)

# print(sound_level)
