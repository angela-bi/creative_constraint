"use client";

import { useEffect, useCallback, useState, useRef } from "react";

import BrushPreview from "./components/brushPreview";
import KlecksDrawing from "./components/klecksDrawing";
import Sketch from "./components/sketch";

// export type Ratio = [number, number, number]

export type RGB = [number, number, number]; // each 0–255
export type Color = {name: string, rgb: RGB}

export default function HomePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pixels, setPixels] = useState<RGB[]>([])
  const [soundLevel, setSoundLevel] = useState<number>(0);

  const white: Color = {name: 'white', rgb: [255, 255, 255]};
  const black: Color = {name: 'black', rgb: [0, 0, 0]};
  const pink: Color = {name: 'pink', rgb: [266, 0, 168]};
  const navy: Color = {name: 'blue', rgb: [104, 115, 159]};
  const gray: Color = {name: 'gray', rgb: [210, 210, 210]};
  const red: Color = {name: 'pink', rgb: [255, 0, 0]};
  const green: Color = {name: 'green', rgb: [0, 255, 0]};
  const blue: Color = {name: 'blue', rgb: [0, 0, 255]}
  const orange: Color = {name: 'orange', rgb: [255, 92, 0]}
  const yellow: Color = {name: 'yellow', rgb: [255, 255, 0]}
  const colors = [white, black, orange, yellow, green, blue, pink];

  const [activeColor, setActiveColor] = useState<Color>(pink)
 
  
  return (
    <main className="p-6">
        <div style={{ display: "flex", flexDirection: "row", height: "95vh", width: "100%", gap: '20px'}}>
          <div style={{ flex: "1" }}>
            <Sketch
              setPixels={setPixels}
              colors={colors}
              activeColor={activeColor}
              setActiveColor={setActiveColor}
            />
          </div>
          <div style={{ flex: "0.5"  }}>
            <BrushPreview
              pixels={pixels}
              // setActiveColor={setActiveColor}
            ></BrushPreview>
          </div>
          <div style={{ flex: "3" }}>
            <KlecksDrawing
              pixels={pixels}
              // soundLevel={soundLevel}
            />
          </div>
        </div>
    </main>
  );
}
