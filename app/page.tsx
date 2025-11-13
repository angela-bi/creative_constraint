"use client";

import { useEffect, useCallback, useState, useRef } from "react";

import { SoundLevelNode } from "./unused_components/soundLevelNode";
import { BrushSettingNode } from "./unused_components/brushSettingNode";
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

  const white: Color = {name: 'white', rgb: [255, 255, 255]};
  const blue: Color = {name: 'blue', rgb: [104, 115, 159]};
  const pink: Color = {name: 'pink', rgb: [243, 121, 169]};
  const green: Color = {name: 'green', rgb: [175, 210, 121]};
  const gray: Color = {name: 'gray', rgb: [210, 210, 210]};
  const colors = [white, pink, blue, green, gray];

  const [activeColor, setActiveColor] = useState<Color>(pink)
  
  return (
    <main className="p-6">
        <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", gap: '20px'}}>
          <div style={{ flex: "1 1 0%" }}>
            <Sketch
              setRatio={setRatio}
              colors={colors}
              activeColor={activeColor}
            />
          </div>
          <div style={{ flex: "1 1 0%" }}>
            {/* <KlecksDrawing></KlecksDrawing> */}
            <DrawingSoftware 
              ratio={ratio}
              setRatio={setRatio}
              colors={colors}
            />
            {/* <BrushPreview></BrushPreview> */}
          </div>
          <MappingList 
            colors={colors}
            setActiveColor={setActiveColor}
          ></MappingList>
        </div>
    </main>
  );
}
