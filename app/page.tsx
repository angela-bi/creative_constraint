"use client";

import { useEffect, useCallback, useState, useRef } from "react";

import BrushPreview from "./components/brushPreview";
import KlecksDrawing from "./components/klecksDrawing";
import Sketch from "./components/sketch";
import HSLHistograms from "./components/HSLHistograms";

// export type Ratio = [number, number, number]

export type RGB = [number, number, number]; // each 0–255
export type Color = {name: string, rgb: RGB}

export default function HomePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pixelsRef = useRef<Uint8ClampedArray | null>(null);
  const [frameId, setFrameId] = useState(0);
  const [soundLevel, setSoundLevel] = useState<number>(0);
  const [smudgeActive, setsmudgeActive] = useState<boolean>(false);

  const white: Color = {name: 'white', rgb: [255, 255, 255]};
  const black: Color = {name: 'black', rgb: [0, 0, 0]};
  const pink: Color = {name: 'pink', rgb: [266, 0, 168]};
  const navy: Color = {name: 'blue', rgb: [0, 0, 255]};
  const gray: Color = {name: 'gray', rgb: [210, 210, 210]};
  const red: Color = {name: 'pink', rgb: [255, 0, 0]};
  const green: Color = {name: 'green', rgb: [0, 255, 0]};
  const blue: Color = {name: 'blue', rgb: [0, 0, 255]}
  const orange: Color = {name: 'orange', rgb: [255, 92, 0]}
  const yellow: Color = {name: 'yellow', rgb: [255, 255, 0]}
  const purple: Color = {name: 'purple', rgb: [148, 0, 211]}
  const colors = [pink, orange, yellow, green, blue, purple];

  const [activeColor, setActiveColor] = useState<Color>(pink)
  
  return (
    <main style={{ height: "100dvh", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
          width: "100%",
          gap: "20px",
          padding: "24px", // moved from main
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <Sketch
            pixelsRef={pixelsRef}
            setFrameId={setFrameId}
            colors={colors}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            setSmudgeActive={setsmudgeActive}
          />
        </div>

        <div style={{ flex: 0.5, minHeight: 0 }}>
          <BrushPreview
            pixelsRef={pixelsRef}
            frameId={frameId}
          />
        </div>

        <div style={{ flex: 3, minHeight: 0 }}>
          <KlecksDrawing
            pixelsRef={pixelsRef}
            frameId={frameId}
            smudgeActive={smudgeActive}
          />
        </div>
      </div>
    </main>
  );
}
