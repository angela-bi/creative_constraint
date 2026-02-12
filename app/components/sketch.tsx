"use client";

import React, { useEffect, useRef, useState } from "react";
import { SketchPicker } from 'react-color';
import { ColorResult } from "react-color";
import { CirclePicker } from "react-color";
// import { Ratio } from "./page";
import { RGB, Color } from "../session/[participantId]/page";
import { Palette } from "./palette";

type SketchProps = {
  // ratio: Ratio;
  // setPixels: React.Dispatch<React.SetStateAction<Uint8ClampedArray>>;
  pixelsRef: React.RefObject<Uint8ClampedArray | null>;
  setFrameId: React.Dispatch<React.SetStateAction<number>>
  colors: Color[];
  activeColor: Color;
  setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
  setSmudgeActive: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Sketch({ pixelsRef, setFrameId, colors, activeColor, setActiveColor, setSmudgeActive }: SketchProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const binInputRef = useRef<HTMLInputElement>(null);
  const pngInputRef = useRef<HTMLInputElement>(null);
  const [savedCanvases, setSavedCanvases] = useState<string[]>([]);

  function sendMessage(type: string, payload?: any) {
    iframeRef.current?.contentWindow?.postMessage({ type, payload }, "*");
  }

  function savePNG() {
    sendMessage("savePNG");
  }

  function importPNG(e: React.ChangeEvent<HTMLInputElement>) {
    // console.log('importPNG called')
    const file = e.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
  
    reader.onload = () => {
      sendMessage("importPNG", reader.result); // send image data URL string
    };
  
    reader.readAsDataURL(file);
  }  

  useEffect(() => {
    setMounted(true)

    const iframe = iframeRef.current;
    if (!iframe) return;

    const origin = window.location.origin;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
        <style>
          html, body { margin: 0; padding: 0; overflow: hidden; }
          canvas { display: block; }
        </style>
      </head>
      <body>
        <script src="${origin}/utils/p5-watercolor.js"></script>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

  }, [])

  useEffect(() => {

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "updatePixels") {
        const pixels = event.data.payload;
        pixelsRef.current = new Uint8ClampedArray(pixels);
        setFrameId(id => id + 1);
      }
      if (event.data?.type === "canvasPNG") {
        setSavedCanvases(prev => [event.data.payload, ...prev]);
      }
      // if (event.data?.type === "requestWatercolorSave") {
      //   const { psd, timestamp } = event.data.payload;
      //   downloadBlob(psd, `drawing-${timestamp}.psd`);
      // }
      if (event.data?.type === "requestWatercolorPNG") {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "exportCanvasPNG",
            payload: event.data.payload
          },
          "*"
        );
      }
      
      if (event.data?.type === "watercolorPNGReady") {
        const png = event.data.payload;
      
        const link = document.createElement("a");
        link.href = png;
        link.download = `watercolor-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      if (event.data?.type === "smudgingActive") {
        setSmudgeActive(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);

  }, []);


  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
  
    iframeRef.current.contentWindow.postMessage(
      {
        type: "updateColor",
        payload: activeColor,
      },
      "*"
    );
  }, [activeColor, colors]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: '10px', width: '100%'}}>
      {/* <select>
        <option value="width">Brush width</option>
      </select> */}
      <iframe
        ref={iframeRef}
        style={{
          width: "470px",
          height: "470px",
          border: "1px solid gray",
          borderRadius: "12px",
          padding: "10px"
        }}
        // sandbox="allow-scripts allow-same-origin"
      />
      <div style={{ display: "flex", flexDirection: "row", gap: '10px', width: '100%'}}>

        <Palette
          colors={colors}
          activeColor={activeColor}
          setActiveColor={setActiveColor}
          onBrushModeChange={(mode) => {
            sendMessage("setBrushMode", mode);
            if (mode === "paint") {
              setSmudgeActive(false);
              // Broadcast message to other components
              window.postMessage({ type: "smudgingInactive" }, "*");
            }
          }}
        ></Palette>
      </div>
      <div>
        Previous versions
        <div style={{ overflowX: "auto", display: "flex", gap: "10px", padding: "10px" }}>
          {savedCanvases.map((src, i) => (
            <img 
              key={i} 
              src={src} 
              style={{ height: "100px", borderRadius: "8px", border: "1px solid #ccc" }} 
              onClick={() => sendMessage("importPNG", src)}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: '10px'}}>
        {/* <button onClick={exportBIN} style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}>
        Export BIN file
        </button>
        Export PNG file
        </button> */}
        <button
          onClick={() => sendMessage("getPNG")}
          style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}
        >
          Save Canvas
        </button>
        <button
          onClick={() => sendMessage("clearCanvas")}
          style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}
        >
          Clear Canvas
        </button>
      </div>
      {/* <input
        type="file"
        accept=".bin"
        ref={binInputRef}
        onChange={handleBINUpload}
      />
      <input
        type="file"
        accept=".png"
        ref={pngInputRef}
        onChange={importPNG}
      /> */}
    </div>
  );
}
