#!/usr/bin/env python3
# # coding=utf-8

import json
import inkex
import wave
import numpy as np

class ChangeColors(inkex.ColorExtension):

    def current_sound_level(self):
        wf = wave.open('sound.wav', 'rb')
        data = wf.readframes(10)
        return int.from_bytes(data, byteorder='little')


    # changes any currently selected objects to the color specified
    def modify_color(self, name, color):
        color.red = self.current_sound_level()
        color.green = self.current_sound_level()
        color.blue = self.current_sound_level()
        return color


if __name__ == '__main__':
    ChangeColors().run()
