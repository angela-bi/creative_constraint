"use client";

import { useEffect, useCallback, useState, useRef } from "react";

import Sketch from "./sketch";
import DrawingSoftware from "./components/drawingSoftware";
import BrushPreview from "./components/brushPreview";
import KlecksDrawing from "./components/klecksDrawing";
import { MappingList } from "./components/mappingList";

// export type Ratio = [number, number, number]

export type RGB = [number, number, number]; // each 0–255
export type Color = {name: string, rgb: RGB}

export default function HomePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [avg, setAvg] = useState<RGB[]>([])
  const [soundLevel, setSoundLevel] = useState<number>(0);

  const white: Color = {name: 'white', rgb: [255, 255, 255]};
  const pink: Color = {name: 'pink', rgb: [237, 37, 93]};
  const navy: Color = {name: 'blue', rgb: [104, 115, 159]};
  const lime: Color = {name: 'green', rgb: [175, 210, 121]};
  const gray: Color = {name: 'gray', rgb: [210, 210, 210]};
  // const pink: Color = {name: 'pink', rgb: [255, 0, 0]};
  const green: Color = {name: 'green', rgb: [0, 255, 0]};
  const blue: Color = {name: 'blue', rgb: [0, 0, 255]}
  const colors = [white, pink, lime, navy, blue, pink, gray, green];

  const [activeColor, setActiveColor] = useState<Color>(white)

  // sound level
  // useEffect(() => {
  //   let audioCtx: AudioContext;
  //   let analyser: AnalyserNode;
  //   let source: MediaStreamAudioSourceNode;
  //   let rafId: number;
  
  //   const soundLevelRef = { current: 0 };
  
  //   navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
  //     audioCtx = new AudioContext();
  //     analyser = audioCtx.createAnalyser();
  //     source = audioCtx.createMediaStreamSource(stream);
  //     source.connect(analyser);
  
  //     const buffer = new Uint8Array(analyser.fftSize);
  
  //     const tick = () => {
  //       if (audioCtx.state === "suspended") {
  //         audioCtx.resume();
  //       }
  
  //       analyser.getByteTimeDomainData(buffer);
  
  //       let sum = 0;
  //       for (let i = 0; i < buffer.length; i++) {
  //         const v = (buffer[i] - 128) / 128;
  //         sum += v * v;
  //       }
  //       const rms = Math.sqrt(sum / buffer.length);
  
  //       soundLevelRef.current = rms ;
  
  //       setSoundLevel(Math.sqrt(soundLevelRef.current)*100);
  
  //       rafId = requestAnimationFrame(tick);
  //     };
  
  //     tick();
  //   });
  
  //   return () => {
  //     cancelAnimationFrame(rafId);
  //     audioCtx?.close();
  //     source?.disconnect();
  //   };
  // }, []);  
  
  return (
    <main className="p-6">
        <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", gap: '20px'}}>
          <div style={{ flex: "1" }}>
            <Sketch
              setAvg={setAvg}
              colors={colors}
              activeColor={activeColor}
              setActiveColor={setActiveColor}
            />
          </div>
          <div style={{ flex: "2" }}>
            <KlecksDrawing
              avg={avg}
              // soundLevel={soundLevel}
              setActiveColor={setActiveColor}
            />
            {/* <DrawingSoftware 
              ratio={ratio}
              setRatio={setRatio}
              colors={colors}
            /> */}
            {/* <BrushPreview></BrushPreview> */}
          </div>
          {/* <MappingList 
            colors={colors}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            soundLevel={soundLevel}
          ></MappingList> */}
        </div>
    </main>
  );
}
