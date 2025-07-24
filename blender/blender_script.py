import sounddevice as sd
import numpy as np
import bpy

audio = sd.rec(int(44100), samplerate=44100, channels=1)
rms = np.linalg.norm(audio) / np.sqrt(len(audio))
print("RMS Volume:", rms) # prints audio level every second

bpy.data.brushes['Tint'].color = (rms, rms, rms)
print(bpy.data.brushes['Tint'].color) # confirm that color got changed

