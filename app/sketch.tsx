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
  const [color, setColor] = useState<RGB | null>([237, 37, 93]);
  const [mounted, setMounted] = useState(false);
  const binInputRef = useRef<HTMLInputElement>(null);
  const pngInputRef = useRef<HTMLInputElement>(null);

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
// By Steve's Makerspace
// https://youtu.be/UpYfjZgxwP0
// Pick your color, slider for brush size, "s" to save a jpg, and you can change variables in lines 5 - 8 below.

let defaultTime = 0.0012; // large = quick dry
let runnyColors = false;
let backgrd = 255; // 255 white; 0 black
let smallCanvas = true;
let state;
dryTime = defaultTime;
let prevMouseX, prevMouseY;
let sliderDrops, buttonDry, buttonWet, buttonDefault;
let colorPicker;
let colorPicked;
let paint = [];
let tempPaint1 = [];
let tempPaint2 = [];

let lastSampleTime = 0;
const sampleInterval = 600; // how many times p5 sends the avg data

function samplePixels() {
  loadPixels();
  const snapshot = new Uint8ClampedArray(pixels);

  const w = width;
  const h = height;

  const result = averageColumnColors(snapshot)
  sendAvg(result);
}

function averageColumnColors() {
  const numCols = 10;
  const colWidth = width / numCols; // 450 / 10 = 45
  let img = get(); // snapshot of canvas pixels
  img.loadPixels();

  let results = [];

  for (let c = 0; c < numCols; c++) {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    // Column x-range
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
      rSum / count,
      gSum / count,
      bSum / count]
    );
  }
  return results;
}

function averageColor(pixels) {
  let r = 0, g = 0, b = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
  }
  return [r / count, g / count, b / count];
}

colorPicked = [255, 255, 255];

function exportBIN() {
  loadPixels();
  // ensure pixels are up-to-date
  // create a copy of the pixel buffer (Uint8ClampedArray)
  const out = new Uint8ClampedArray(pixels);
  const blob = new Blob([out], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'canvas.bin';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importBIN(arrayBuffer) {
  // arrayBuffer should be an ArrayBuffer containing raw RGBA bytes
  const arr = new Uint8ClampedArray(arrayBuffer);

  // sanity check
  if (arr.length !== width * height * 4) {
    console.warn('importBIN: buffer size mismatch', arr.length, width * height * 4);
    // proceed anyway or return
  }

  // 1) Put the bytes into the paint array so the simulation uses them
  // paint expects a JS array of numbers length width*height*4
  paint = Array.from(arr);

  // 2) Make independent temp arrays from the imported paint
  tempPaint1 = paint.slice();
  tempPaint2 = paint.slice();

  // 3) Also push the pixels[] buffer to match immediately (so it displays now)
  loadPixels();
  for (let i = 0; i < pixels.length && i < arr.length; i++) {
    pixels[i] = arr[i];
  }
  updatePixels();
}

function importPNG(dataURL) {
  console.log("inside importPNG");

  loadImage(dataURL, (img) => {
    image(img, 0, 0, width, height);
    loadPixels(); // update p5 pixels buffer
  });
}


function savePNG() {
  saveCanvas('my_drawing', 'png');
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

function setup() {
  window.addEventListener("message", (event) => {
    if (event.data?.type === "updateColor") {
      //const { tl, tr, bl, br } = event.data.payload;
      // console.log(tl, tr, bl, br)
      //console.log('event data payload', event.data.payload)
      colorPicked = [event.data.payload[0], event.data.payload[1], event.data.payload[2]];
      //console.log("Updated colorPicked:", colorPicked);
    }
  });

  pixelDensity(1);

  let c = createCanvas(450,450);

  background(255);

  setupPointerSupport(c.elt);

  // colorPicker = createColorPicker("#ed225d");
  // colorPicker.position(0, height + 5);
  // sliderDrops = createSlider(100, 600, 100);
  // sliderDrops.position(70, height + 5);
  // buttonDry = createButton("Dry All");
  // buttonDry.position(210, height + 5);
  // buttonWet = createButton("Keep Wet");
  // buttonWet.position(270, height + 5);
  // buttonDefault = createButton("Default Dry");
  // buttonDefault.position(350, height + 5);
  // state = createElement("state", "Default");
  // state.position(450, height + 5);

  paint = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      paint.push(backgrd, backgrd, backgrd, 0);
    }
  }

  // CLONE the arrays — do not assign references
  tempPaint1 = paint; 
  tempPaint2 = paint;
}

function draw() {
  // buttonDry.mousePressed(dry);
  // buttonWet.mousePressed(wet);
  // buttonDefault.mousePressed(defaultDry);
  // paintDrop = sliderDrops.value();
  paintDrop = 70;

  addPaint();
  update();
  render();
  
  if (millis() - lastSampleTime > sampleInterval) {
    samplePixels();
    lastSampleTime = millis();
  }
}

function dry() {
  dryTime = 1000;
  state.html("Dry");
}
function wet() {
  dryTime = 0.0001;
  state.html("Wet");
}
function defaultDry() {
  dryTime = defaultTime;
  state.html("Default");
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
  prevMouseX = constrain(prevMouseX, 0, width - 1);
  prevMouseY = constrain(prevMouseY, 0, height - 1);
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

// if there's a lot of color in one place, spread it around

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
    }
  }
  updatePixels();
}

// Save art as jpg.
function keyTyped() {
  if (key === "s") {
    save("myCanvas.jpg");
  }
}

window.addEventListener('message', event => {
  const { type, payload } = event.data;

  if (type === 'savePNG') savePNG();
  if (type === 'exportBIN') exportBIN();
  if (type === "importPNG") importPNG(payload);
  if (type === 'importBIN') importBIN(payload);
});
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
            window.parent.postMessage({ type: "data", payload: Avg }, "*");
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
      setColor([activeColor[0], activeColor[1], activeColor[2]]) // need to write a function to convert between types
      //console.log('color1: ', color1)
      iframe.contentWindow.postMessage(
        { type: "updateColor", payload: activeColor },
        "*"
      );
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "data") {
        const avg = event.data.payload;
        //('event.data.payload', event.data.payload)
        setAvg(avg)

        // const mix_ratio = mix3Colors(colors[1].rgb, colors[2].rgb, colors[3].rgb, avg)
        
        // console.log('mix_ratio: ', mix_ratio)
        // setRatio([mix_ratio['ratio1'], mix_ratio['ratio2'], mix_ratio['ratio3']])
        //setRatio([mix_ratio['ratioC1'], mix_ratio['ratioC2']])
        //console.log('3 color mix ratio: ', mix3Colors(pink, blue, white, avg))
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
          Previous versions
        </div>
        <button onClick={exportBIN} style={{}}>
        Export BIN file
        </button>
        <button onClick={savePNG} style={{}}>
        Export PNG file
        </button>
        <input
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
        />
      </div>
    </div>
  );
}
