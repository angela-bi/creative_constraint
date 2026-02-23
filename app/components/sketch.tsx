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
  participantId: string
  pixelsRef: React.RefObject<Uint8ClampedArray | null>;
  setFrameId: React.Dispatch<React.SetStateAction<number>>
  colors: Color[];
  activeColor: Color;
  setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
  setSmudgeActive: React.Dispatch<React.SetStateAction<boolean>>;
};

type WatercolorRecord = {
  id: number;
  signedUrl: string;
  saved_at: string;
};

export default function Sketch({ pixelsRef, setFrameId, colors, activeColor, setActiveColor, setSmudgeActive, participantId }: SketchProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [savedCanvases, setSavedCanvases] = useState<WatercolorRecord[]>([]);

  function sendMessage(type: string, payload?: any) {
    iframeRef.current?.contentWindow?.postMessage({ type, payload }, "*");
  }

  // useEffect(() => {
  //   const fetchWatercolors = async () => {
  //     const res = await fetch(`/api/save-watercolor?participantId=${participantId}`);
  //     const data = await res.json();
  //     setSavedCanvases(data);
  //   };
  
  //   fetchWatercolors();
  // }, [participantId]);

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
      if (event.data?.type === "saveCanvasResponse") {
        let { pngData, saveId, isAuto } = event.data.payload;
      
        // Only add to UI history for manual saves
        if (isAuto === false) {
          // Send PNG to page.tsx for DB save
          window.postMessage(
            {
              type: "savetoDBwatercolor",
              payload: {
                watercolorPNG: pngData,
                saveId
              }
            },
            "*"
          );
        } else {
          // Autosave / switch save: notify page that watercolor is "done"
          window.postMessage(
            {
              type: "watercolorCheckpointReady",
              payload: { saveId }
            },
            "*"
          );
        }
      }
      if (event.data?.type === "watercolorSavedToDB") {
        const newRecord = event.data.payload;
      
        setSavedCanvases(prev => [newRecord, ...prev]);
      }
      if (event.data?.type === "requestAllWatercolorCanvases") {
        // console.log('savedCanvases', savedCanvasesRef.current)
      }
      if (event.data?.type === "requestWatercolorPNG") {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "exportCanvasPNG",
            payload: event.data.payload
          },
          "*"
        );
      }

      if (event.data?.type === "saveCanvas") {
        const { saveId, isAuto } = event.data?.payload
        if (isAuto === false) { // if its NOT automatic aka only save canvas will send a request to iframe for watercolor
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "saveCanvas",
              payload: {saveId: saveId, isAuto: isAuto}
            },
            "*"
          );
        }
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
          {savedCanvases.map((canvas) => (
            <img 
              key={canvas.id} 
              src={canvas.signedUrl} 
              style={{ height: "100px", borderRadius: "8px", border: "1px solid #ccc" }} 
              onClick={() => {
                window.postMessage({ type: "canvasSwitched", payload: { canvasId: canvas.id, signedUrl: canvas.signedUrl }  }, "*");
                sendMessage("importPNG", canvas.signedUrl);
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: '10px'}}>
        <button
          onClick={() => {
            window.postMessage({ type: "saveCanvasButtonPressed" }, "*");
          }}
          style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}
        >
          Save Canvas
        </button>
        <button
          onClick={() => {
            sendMessage("clearCanvas");
            window.postMessage({ type: "canvasCleared" }, "*");
          }}
          style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}
        >
          Clear Canvas
        </button>
      </div>
    </div>
  );
}
