import sounddevice as sd
import numpy as np
import bpy

audio = sd.rec(int(44100), samplerate=44100, channels=1)
audio = np.array(audio.flatten())
rms = np.linalg.norm(audio) / np.sqrt(len(audio))
print("audio shape:", audio.shape)
print("RMS Volume:", rms)

bpy.data.brushes['Tint'].color = (np.random.choice(audio)*10, np.random.choice(audio)*10, np.random.choice(audio)*10)
print(bpy.data.brushes['Tint'].color)