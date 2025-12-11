"use client";

import React, { useEffect, useRef, useState } from "react";
import { SketchPicker } from 'react-color';
import { ColorResult } from "react-color";
import { CirclePicker } from "react-color";
// import { Ratio } from "./page";
import { RGB, Color } from "./page";
import { Palette } from "./components/palette";

type SketchProps = {
  // ratio: Ratio;
  setPixels: React.Dispatch<React.SetStateAction<RGB[]>>;
  colors: Color[];
  activeColor: Color;
  setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export default function Sketch({ setPixels, colors, activeColor, setActiveColor }: SketchProps) {
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

// helpers

function samplePixels() {
  loadPixels();
  const snapshot = new Uint8ClampedArray(pixels);

  const w = width;
  const h = height;

  const result = getPixels(snapshot)
  sendPixels(result);
}

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

function getPixels() {

  let img = get();     // snapshot of the whole canvas
  img.loadPixels();

  let results = [];

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let idx = 4 * (y * width + x);
      let r = img.pixels[idx];
      let g = img.pixels[idx + 1];
      let b = img.pixels[idx + 2];

      results.push([
        r,
        g,
        b
      ]);
    }
  }

  return results;
}

let isPointerDown = false;
let pointerX = 0;
let pointerY = 0;
let pointerPressure = 1.0;

function setupPointerSupport(canvasElt) {
  canvasElt.addEventListener('pointerdown', (e) => {
    isPointerDown = true;

    pointerX = e.offsetX;
    pointerY = e.offsetY;
    pointerPressure = e.pressure || 1.0;

    prevMouseX = pointerX;
    prevMouseY = pointerY;
  });

  canvasElt.addEventListener('pointermove', (e) => {
    pointerX = e.offsetX;
    pointerY = e.offsetY;
    pointerPressure = e.pressure || 1.0;
  });

  canvasElt.addEventListener('pointerup', () => {
    isPointerDown = false;
  });

  canvasElt.style.touchAction = "none";
}

// global vars

let defaultTime = 0.0012; // large = quick dry
let runnyColors = false;
let backgrd = 255; // 255 white; 0 black
let smallCanvas = true;
let state;
dryTime = defaultTime;
let prevMouseX, prevMouseY;
let sliderDrops, buttonDry, buttonWet, buttonDefault;
let colorPicker;
let colorPicked = [237, 37, 93];
let paint = [];
let tempPaint1 = [];
let tempPaint2 = [];

let lastSampleTime = 0;
const sampleInterval = 2000; // bigger = less often, smaller = more often

function setup() {
  pixelDensity(1);

  let c = createCanvas(500,500);

  background(255);

  setupPointerSupport(c.elt);

  // allow file drops for PNG import
  c.drop(handleFile);

  // listen for React messages
  window.addEventListener("message", (event) => {
    const { type, payload } = event.data;

    if (type === "setBrushSize") {
      brushSize = payload;
    }
    if (type === "setBrushColor") {
      brushColor = payload.rgb;
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
      clearCanvas();
      importPNG(payload);
    }
    if (type === "updateColor") {
      colorPicked = [payload.rgb[0], payload.rgb[1], payload.rgb[2]];
    }
    // if (type === "updateAvg") {
    //   // const cols = averageColumnColors();
    //   // console.log('cols', cols)
    //   // window.parent.postMessage({ type: "updateAvg", payload: cols }, "*");
    // }
    if (type === "getPNG") {
      const pngData = document.querySelector("canvas").toDataURL("image/png");
      window.parent.postMessage({ type: "canvasPNG", payload: pngData }, "*");
    }
    if (type === "setMode") mode = payload;

  });

  paint = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      paint.push(backgrd, backgrd, backgrd, 0);
    }
  }

  tempPaint1 = paint;
  tempPaint2 = paint;
}

function draw() {
  paintDrop = 70;

  addPaint();
  update();
  render();

  if (millis() - lastSampleTime > sampleInterval) {
    samplePixels();
    lastSampleTime = millis();
  }
}

// add paint when clicking - start with dragging
function addPaint() {
  if (
    isPointerDown &&
    mouseIsPressed &&
    mouseX >= 0 &&
    mouseX <= width &&
    mouseY >= 0 &&
    mouseY <= height
  ) {
    let distance = dist(prevMouseX, prevMouseY, pointerX, pointerY);
    let numPoints = floor(distance / 1); // larger number = more gaps and fewer points; these two lines from George Profenza, noted below.
    drawLinePoints(prevMouseX, prevMouseY, pointerX, pointerY, numPoints);

    // add paint when clicking in one place
    if (pointerX == prevMouseX && pointerY == prevMouseY) {
      renderPoints(mouseX, mouseY);
    }
  }
  prevMouseX = pointerX;
  prevMouseY = pointerY;

  // preventing a wrap around error when dragging off canvas and back on
  // prevMouseX = constrain(prevMouseX, 0, width - 1);
  // prevMouseY = constrain(prevMouseY, 0, height - 1);
}

// calculate points when dragging
// This function from George Profenza on stackoverflow https://stackoverflow.com/questions/63959181/how-do-you-draw-a-line-in-a-pixel-array
function drawLinePoints(x1, y1, x2, y2, points) {
  for (let i = 0; i < points; i++) {
    let t = map(i, 0, points, 0.0, 1.0);
    let x = round(lerp(x1, x2, t));
    let y = round(lerp(y1, y2, t));
    renderPoints(x, y);
  }
}

// replace array points when drawing

function renderPoints(x, y) {
  let arrayPos = (x + y * width) * 4;
  let newR = (paint[arrayPos + 0] + colorPicked[0]) / 2;
  let newG = (paint[arrayPos + 1] + colorPicked[1]) / 2;
  let newB = (paint[arrayPos + 2] + colorPicked[2]) / 2;
  let newN = paint[arrayPos + 3] + paintDrop;
  paint.splice(arrayPos, 4, newR, newG, newB, newN); // replace the current pixel color with the newly calculated color
}


function update() {

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let arrayPos = (x + y * width) * 4;
      if (paint[arrayPos + 3] > 4) {
        tempPaint1[arrayPos + 3] = paint[arrayPos + 3] - 4;

        // mix pixel to right
        if (x < width - 1) {
          tempPaint1[arrayPos + 4] =
            (paint[arrayPos + 4] + paint[arrayPos]) / 2;
          tempPaint1[arrayPos + 5] =
            (paint[arrayPos + 5] + paint[arrayPos + 1]) / 2;
          tempPaint1[arrayPos + 6] =
            (paint[arrayPos + 6] + paint[arrayPos + 2]) / 2;
          tempPaint1[arrayPos + 7] = paint[arrayPos + 7] + 1;
        }

        // mix pixel to left
        if (x > 0) {
          tempPaint1[arrayPos - 4] =
            (paint[arrayPos - 4] + paint[arrayPos]) / 2;
          tempPaint1[arrayPos - 3] =
            (paint[arrayPos - 3] + paint[arrayPos + 1]) / 2;
          tempPaint1[arrayPos - 2] =
            (paint[arrayPos - 2] + paint[arrayPos + 2]) / 2;
          tempPaint1[arrayPos - 1] = paint[arrayPos - 1] + 1;
        }

        // mix pixel below
        tempPaint1[arrayPos + width * 4] =
          (paint[arrayPos + width * 4] + paint[arrayPos]) / 2;
        tempPaint1[arrayPos + width * 4 + 1] =
          (paint[arrayPos + width * 4 + 1] + paint[arrayPos + 1]) / 2;
        tempPaint1[arrayPos + width * 4 + 2] =
          (paint[arrayPos + width * 4 + 2] + paint[arrayPos + 2]) / 2;
        tempPaint1[arrayPos + width * 4 + 3] =
          paint[arrayPos + width * 4 + 3] + 1;

        // mix pixel above
        tempPaint1[arrayPos - width * 4] =
          (paint[arrayPos - width * 4] + paint[arrayPos]) / 2;
        tempPaint1[arrayPos - width * 4 + 1] =
          (paint[arrayPos - width * 4 + 1] + paint[arrayPos + 1]) / 2;
        tempPaint1[arrayPos - width * 4 + 2] =
          (paint[arrayPos - width * 4 + 2] + paint[arrayPos + 2]) / 2;
        tempPaint1[arrayPos - width * 4 + 3] =
          paint[arrayPos - width * 4 + 3] + 1;
      }

      // gradually dry paint
      tempPaint1[arrayPos + 3] = paint[arrayPos + 3] - dryTime;
      if (tempPaint1[arrayPos + 3] < 0) {
        tempPaint1[arrayPos + 3] = 0;
      }
    }
  }
  
  if (runnyColors == true){
    paint = tempPaint1;
  }
    else {
  for (let x = width; x > 0; x--) {
    for (let y = height; y > 0; y--) {
      let arrayPos = (x + y * width) * 4;
      if (paint[arrayPos + 3] > 4) {
        tempPaint2[arrayPos + 3] = paint[arrayPos + 3] - 4;

        // mix pixel to right
        if (x < width - 1) {
          tempPaint2[arrayPos + 4] =
            (paint[arrayPos + 4] + paint[arrayPos]) / 2;
          tempPaint2[arrayPos + 5] =
            (paint[arrayPos + 5] + paint[arrayPos + 1]) / 2;
          tempPaint2[arrayPos + 6] =
            (paint[arrayPos + 6] + paint[arrayPos + 2]) / 2;
          tempPaint2[arrayPos + 7] = paint[arrayPos + 7] + 1;
        }

        // mix pixel to left
        if (x > 0) {
          tempPaint2[arrayPos - 4] =
            (paint[arrayPos - 4] + paint[arrayPos]) / 2;
          tempPaint2[arrayPos - 3] =
            (paint[arrayPos - 3] + paint[arrayPos + 1]) / 2;
          tempPaint2[arrayPos - 2] =
            (paint[arrayPos - 2] + paint[arrayPos + 2]) / 2;
          tempPaint2[arrayPos - 1] = paint[arrayPos - 1] + 1;
        }

        // mix pixel below
        tempPaint2[arrayPos + width * 4] =
          (paint[arrayPos + width * 4] + paint[arrayPos]) / 2;
        tempPaint2[arrayPos + width * 4 + 1] =
          (paint[arrayPos + width * 4 + 1] + paint[arrayPos + 1]) / 2;
        tempPaint2[arrayPos + width * 4 + 2] =
          (paint[arrayPos + width * 4 + 2] + paint[arrayPos + 2]) / 2;
        tempPaint2[arrayPos + width * 4 + 3] =
          paint[arrayPos + width * 4 + 3] + 1;

        // mix pixel above
        tempPaint2[arrayPos - width * 4] =
          (paint[arrayPos - width * 4] + paint[arrayPos]) / 2;
        tempPaint2[arrayPos - width * 4 + 1] =
          (paint[arrayPos - width * 4 + 1] + paint[arrayPos + 1]) / 2;
        tempPaint2[arrayPos - width * 4 + 2] =
          (paint[arrayPos - width * 4 + 2] + paint[arrayPos + 2]) / 2;
        tempPaint2[arrayPos - width * 4 + 3] =
          paint[arrayPos - width * 4 + 3] + 1;
      }

      // gradually dry paint
      tempPaint2[arrayPos + 3] = paint[arrayPos + 3] - dryTime;
      if (tempPaint2[arrayPos + 3] < 0) {
        tempPaint2[arrayPos + 3] = 0;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let arrayPos = (x + y * width) * 4;
      paint[arrayPos] = (tempPaint1[arrayPos] + tempPaint2[arrayPos]) / 2;
    }
  }
}
}

let avg_r = 0;
let avg_g = 0
let avg_b = 0

// render all pixels
function render() {
  loadPixels();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let pix = (x + y * width) * 4;
      let arrayPos = (x + y * width) * 4;
      pixels[pix] = paint[arrayPos];
      pixels[pix + 1] = paint[arrayPos + 1];
      pixels[pix + 2] = paint[arrayPos + 2];
      //pixels[pix + 3] = paint[arrayPos + 3];
    }
  }
  updatePixels();
}

function clearCanvas() {
  paint = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      paint.push(backgrd, backgrd, backgrd, 0);
    }
  }

  tempPaint1 = paint;
  tempPaint2 = paint;
}

function handleFile(file) {
  if (file.type === "image") {
    importPNG(file.data);
  }
}

function importPNG(dataURL) {
  loadImage(dataURL, (img) => {
    // Draw image into the canvas so we can read its pixels
    image(img, 0, 0, width, height);

    loadPixels(); // load canvas pixels[]
    
    // Fill paint[] from pixels[]
    for (let i = 0; i < paint.length; i += 4) {
      paint[i] = pixels[i];
      paint[i + 1] = pixels[i + 1];
      paint[i + 2] = pixels[i + 2];
    }

    // now call your existing watercolor renderer
    render();  
    updatePixels();

    // After watercolor is rendered, extract avg column colors
    const newPixels = getPixels();
    window.parent.postMessage(
      { type: "updatePixels", payload: newPixels },
      "*"
    );
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
          window.sendPixels = (pixels) => {
            window.parent.postMessage({ type: "updatePixels", payload: pixels }, "*");
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
      iframe.contentWindow.postMessage(
        { type: "updateColor", payload: activeColor },
        "*"
      );
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "updatePixels") {
        const pixels = event.data.payload;
        //('event.data.payload', event.data.payload)
        setPixels(pixels)
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
      <div style={{ display: "flex", flexDirection: "row", gap: '10px', width: '100%'}}>

        <Palette
          colors={colors}
          activeColor={activeColor}
          setActiveColor={setActiveColor}
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
        <button onClick={savePNG} style={{backgroundColor: 'lightgray', borderRadius: '5px', padding: '5px'}}>
        Export PNG file
        </button> */}
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
  );
}
