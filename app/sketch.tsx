"use client";

import React, { useEffect, useRef, useState } from "react";
import { SketchPicker } from 'react-color';
import { ColorResult } from "react-color";
import { CirclePicker } from "react-color";
// import { Ratio } from "./page";
import { MappingList } from "./components/mappingList";
import { RGB, Color } from "./page";

type SketchProps = {
  // ratio: Ratio;
  setAvg: React.Dispatch<React.SetStateAction<RGB[]>>;
  colors: Color[];
  activeColor: RGB;
};

export default function Sketch({ setAvg, colors, activeColor }: SketchProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const binInputRef = useRef<HTMLInputElement>(null);
  const pngInputRef = useRef<HTMLInputElement>(null);
  const [savedCanvases, setSavedCanvases] = useState<string[]>([]);

  function sendMessage(type: string, payload?: any) {
    iframeRef.current?.contentWindow?.postMessage({ type, payload }, "*");
  }

  function exportBIN() {
    sendMessage("exportBIN");
  }

  function handleBINUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      sendMessage("importBIN", reader.result);
    };
    reader.readAsArrayBuffer(file);
  }

  function savePNG() {
    sendMessage("savePNG");
  }

  function importPNG(e: React.ChangeEvent<HTMLInputElement>) {
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

    const code = `

function averageColumnColors() {
  const numCols = 10;
  const colWidth = width / numCols;
  
  let img = get();     // snapshot of the whole canvas
  img.loadPixels();

  let results = [];

  for (let c = 0; c < numCols; c++) {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    let xStart = Math.floor(c * colWidth);
    let xEnd = Math.floor((c + 1) * colWidth);

    for (let x = xStart; x < xEnd; x++) {
      for (let y = 0; y < height; y++) {
        let idx = 4 * (y * width + x);
        rSum += img.pixels[idx];
        gSum += img.pixels[idx + 1];
        bSum += img.pixels[idx + 2];
        count++;
      }
    }

    results.push([
      Math.round(rSum / count),
      Math.round(gSum / count),
      Math.round(bSum / count)
    ]);
  }

  return results;
}


function setup() {
  createCanvas(450, 450);
  background(255);

  // allow file drops for PNG import
  let cnv = createCanvas(450, 450);
  cnv.drop(handleFile);

  // smoother lines
  strokeJoin(ROUND);
  strokeCap(ROUND);

  // listen for React messages
  window.addEventListener("message", (event) => {
    const { type, payload } = event.data;

    if (type === "setBrushSize") {
      brushSize = payload;
    }
    if (type === "setBrushColor") {
      brushColor = payload;
    }
    if (type === "clearCanvas") {
      clearCanvas();
    }
    if (type === "savePNG") {
      // Temporarily draw a white background behind everything
      push();
      // Create a copy of the current canvas
      let img = get();
      background(255);        // white background
      image(img, 0, 0);      // draw the original canvas on top
      saveCanvas("drawing", "png");
      pop();                  // restore canvas state
    }
    if (type === "importPNG") {
      importPNG(payload);
    }
    if (type === "updateColor") {
      brushColor = payload;
    }
    if (type === "updateAvg") {
      const cols = averageColumnColors();
      console.log('cols', cols)
      // window.parent.postMessage({ type: "updateAvg", payload: cols }, "*");
    }
    if (type === "getPNG") {
      const pngData = document.querySelector("canvas").toDataURL("image/png");
      window.parent.postMessage({ type: "canvasPNG", payload: pngData }, "*");
    }
    if (type === "setMode") mode = payload;

  });
}

let mode = "brush"; // "brush" or "smudge"
let brushSize = 10;
let brushColor = [0, 0, 0];
let smudgeStrength = 0.3;
let prevCanvasPixels;

function smudgeStroke(x1, y1, x2, y2) {
  loadPixels();
  if (!prevCanvasPixels) prevCanvasPixels = new Uint8ClampedArray(pixels);

  let steps = Math.max(abs(x2 - x1), abs(y2 - y1));
  let half = Math.floor(brushSize / 2);

  for (let i = 0; i <= steps; i++) {
    let xi = lerp(x1, x2, i / steps);
    let yi = lerp(y1, y2, i / steps);

    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        let px = Math.floor(xi + dx);
        let py = Math.floor(yi + dy);
        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        let idx = 4 * (py * width + px);

        // Sample a pixel from the previous frame slightly behind the stroke
        let sx = Math.floor(px - (x2 - x1) * 0.5);
        let sy = Math.floor(py - (y2 - y1) * 0.5);
        if (sx < 0) sx = 0;
        if (sx >= width) sx = width-1;
        if (sy < 0) sy = 0;
        if (sy >= height) sy = height-1;

        let sIdx = 4 * (sy * width + sx);

        pixels[idx]     = lerp(prevCanvasPixels[sIdx], pixels[idx], smudgeStrength);
        pixels[idx + 1] = lerp(prevCanvasPixels[sIdx + 1], pixels[idx + 1], smudgeStrength);
        pixels[idx + 2] = lerp(prevCanvasPixels[sIdx + 2], pixels[idx + 2], smudgeStrength);
      }
    }
  }

  updatePixels();
  prevCanvasPixels.set(pixels); // update for continuous smudge
}


function draw() {
  if (mouseIsPressed) {
    if (mode === "brush") {
      stroke(brushColor);
      strokeWeight(brushSize);
      line(pmouseX, pmouseY, mouseX, mouseY);
    } else if (mode === "smudge") {
      smudgeStroke(pmouseX, pmouseY, mouseX, mouseY);
    }

    if (frameCount % 10 === 0) {
      const cols = averageColumnColors();
      window.parent.postMessage({ type: "updateAvg", payload: cols }, "*");
    }
  }
}

function clearCanvas() {
  background(255);
}

/* -----------------------------
   PNG IMPORT (FILE OR MESSAGE)
-------------------------------- */

function handleFile(file) {
  if (file.type === "image") {
    importPNG(file.data);
  }
}

function importPNG(dataURL) {
  background(255);
  loadImage(dataURL, (img) => {
    image(img, 0, 0, width, height); // stretch to full canvas
    const cols = averageColumnColors();
    console.log('cols', cols)
    window.parent.postMessage({ type: "updateAvg", payload: cols }, "*");
  });
}
`
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
        <script>
          // Allow p5 code to send structured data to parent
          window.sendAvg = (Avg) => {
            window.parent.postMessage({ type: "updateAvg", payload: Avg }, "*");
          };

          try {
            ${code}
          } catch (err) {
            document.body.innerHTML = '<pre style="color:red;">' + err + '</pre>';
            console.error(err);
          }
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

  }, [])

  useEffect(() => {
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
  
    // Send color updates to iframe
    if (colors.length > 0 && iframe.contentWindow) {
      // console.log('sketchPickerColor: ', activeColor)
      //console.log('color1: ', color1)
      iframe.contentWindow.postMessage(
        { type: "updateColor", payload: activeColor },
        "*"
      );
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "updateAvg") {
        const avg = event.data.payload;
        //('event.data.payload', event.data.payload)
        setAvg(avg)
      }
      if (event.data?.type === "canvasPNG") {
        setSavedCanvases(prev => [event.data.payload, ...prev]);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);

  }, [activeColor]);


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
    <div style={{ display: "flex", flexDirection: "row", height: "100%", gap: '20px'}}>
      <div style={{ display: "flex", flexDirection: "column", gap: '10px', width: '100%'}}>
        {/* <select>
          <option value="width">Brush width</option>
        </select> */}
        <iframe
          ref={iframeRef}
          style={{
            width: "100%",
            height: "500px",
            border: "1px solid gray",
            borderRadius: "12px",
            padding: "10px"
          }}
          // sandbox="allow-scripts allow-same-origin"
        />
        <div>
          <button
            onClick={() => sendMessage("setMode", "brush")}
            style={{ backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}
          >
            Brush
          </button>

          <button
            onClick={() => sendMessage("setMode", "smudge")}
            style={{ backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}
          >
            Smudge
          </button>
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
          <button onClick={exportBIN} style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}>
          Export BIN file
          </button>
          <button onClick={savePNG} style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}>
          Export PNG file
          </button>
          <button
            onClick={() => sendMessage("getPNG")}
            style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}
          >
            Save Canvas
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
    </div>
  );
}
