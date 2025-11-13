"use client";

import { useEffect, useCallback, useState, useRef } from "react";

import Sketch from "./sketch";
import DrawingSoftware from "./components/drawingSoftware";
import BrushPreview from "./components/brushPreview";
import KlecksDrawing from "./components/klecksDrawing";
import { MappingList } from "./components/mappingList";

export type Ratio = [number, number]

export type RGB = [number, number, number]; // each 0–255
export type Color = {name: string, rgb: RGB}

export default function HomePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ratio, setRatio] = useState<Ratio>([1, 0]) // first one is brush.width, second is sound
  const [soundLevel, setSoundLevel] = useState<number>(0);

  const white: Color = {name: 'white', rgb: [255, 255, 255]};
  const pink: Color = {name: 'pink', rgb: [243, 121, 169]};
  const blue: Color = {name: 'blue', rgb: [104, 115, 159]};
  const green: Color = {name: 'green', rgb: [175, 210, 121]};
  const gray: Color = {name: 'gray', rgb: [210, 210, 210]};
  const colors = [white, pink, blue, green, gray];

  const [activeColor, setActiveColor] = useState<number>(1)

  // sound level
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let rafId: number;
  
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
  
      const buffer = new Uint8Array(analyser.fftSize);
  
      const tick = () => {
        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume();
        }
  
        analyser!.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
  
        // smooth the sound level to avoid jitter
        setSoundLevel((prev) => prev * 0.8 + rms * 0.2);
  
        rafId = requestAnimationFrame(tick);
      };
      tick();
    });
  
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      audioCtx?.close();
      source?.disconnect();
    };
  }, []);
  
  return (
    <main className="p-6">
        <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", gap: '20px'}}>
          <div style={{ flex: "1" }}>
            <Sketch
              setRatio={setRatio}
              colors={colors}
              activeColor={activeColor}
            />
          </div>
          <div style={{ flex: "2" }}>
            <KlecksDrawing
              ratio={ratio}
              brushSize={ratio[0]}
            />
            {/* <DrawingSoftware 
              ratio={ratio}
              setRatio={setRatio}
              colors={colors}
            /> */}
            {/* <BrushPreview></BrushPreview> */}
          </div>
          <MappingList 
            colors={colors}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            soundLevel={soundLevel}
          ></MappingList>
        </div>
    </main>
  );
}
