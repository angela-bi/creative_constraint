"use client";

import React, { useEffect, useRef, useState } from "react";
import { SketchPicker } from 'react-color';
import { ColorResult } from "react-color";
import { CirclePicker } from "react-color";
import { Ratio } from "./page";
import { MappingList } from "./components/mappingList";
import { RGB, Color } from "./page";

type SketchProps = {
  // ratio: Ratio;
  setRatio: React.Dispatch<React.SetStateAction<Ratio>>;
  colors: Color[];
  activeColor: number;
};

export default function Sketch({ setRatio, colors, activeColor }: SketchProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [avg, setAvg] = useState<RGB | null>(null);
  const [color1, setColor1] = useState<RGB | null>([237, 37, 93]);
  const [color2, setColor2] = useState<RGB | null>(null);
  const [mounted, setMounted] = useState(false);

  // for 1 color and canvas
  function computeMixRatio(c1: RGB, c2: RGB, target: RGB) {
    // convert to linear RGB (undo sRGB gamma)
    const toLinear = (c: number) =>
      c <= 0.04045 * 255 ? c / (12.92 * 255) : Math.pow((c / 255 + 0.055) / 1.055, 2.4);

    const lin = (rgb: RGB) => rgb.map(toLinear) as RGB;

    const lin_c1 = lin(c1);
    const lin_c2 = lin(c2);
    const lin_t = lin(target);

    const sub = (a: RGB, b: RGB) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as RGB;
    const dot = (a: RGB, b: RGB) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const add = (a: RGB, b: RGB) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as RGB;
    const scale = (a: RGB, s: number) => [a[0]*s, a[1]*s, a[2]*s] as RGB;

    // compute t minimizing ||(1−t)P + tB − T||²
    const c1_c2 = sub(lin_c2, lin_c1);
    const t_c1 = sub(lin_t, lin_c1);
    let t = dot(t_c1, c1_c2) / dot(c1_c2, c1_c2);
    t = Math.max(0, Math.min(1, t)); // clamp to [0,1]

    // reconstruct blended color for reference
    const mix = add(scale(lin_c1, 1 - t), scale(lin_c2, t));
    const toSrgb = (c: number) =>
      c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    const srgb = mix.map(c => Math.round(toSrgb(c) * 255)) as RGB;

    return {
      ratioC1: t,
      ratioC2: 1 - t,
      mixedRGB: srgb
    };
  }

  // for 2 colors and canvas
  function mix3Colors(
    c1: RGB, c2: RGB, c3: RGB,
    target: RGB
  ) {
    // normalize 0–1
    const toLinear = (c: RGB) => c.map(v => v / 255) as RGB;
    const [a, b, c] = [toLinear(c1), toLinear(c2), toLinear(c3)];
    const t = toLinear(target);

    // form matrix M (3x3)
    const M = [
      [a[0], b[0], c[0]],
      [a[1], b[1], c[1]],
      [a[2], b[2], c[2]],
    ];

    // solve M * w = t  → w = M⁻¹ * t
    const det = (
      M[0][0] * (M[1][1]*M[2][2] - M[2][1]*M[1][2]) -
      M[0][1] * (M[1][0]*M[2][2] - M[2][0]*M[1][2]) +
      M[0][2] * (M[1][0]*M[2][1] - M[2][0]*M[1][1])
    );

    if (Math.abs(det) < 1e-6) {
      console.warn("Matrix is near singular; cannot invert accurately");
      return { ratio1: 0, ratio2: 0, ratio3: 1 };
    }

    const inv = [
      [
        (M[1][1]*M[2][2] - M[2][1]*M[1][2]) / det,
        (M[0][2]*M[2][1] - M[0][1]*M[2][2]) / det,
        (M[0][1]*M[1][2] - M[0][2]*M[1][1]) / det,
      ],
      [
        (M[1][2]*M[2][0] - M[1][0]*M[2][2]) / det,
        (M[0][0]*M[2][2] - M[0][2]*M[2][0]) / det,
        (M[1][0]*M[0][2] - M[0][0]*M[1][2]) / det,
      ],
      [
        (M[1][0]*M[2][1] - M[2][0]*M[1][1]) / det,
        (M[2][0]*M[0][1] - M[0][0]*M[2][1]) / det,
        (M[0][0]*M[1][1] - M[1][0]*M[0][1]) / det,
      ],
    ];

    // multiply inv * t
    const w = [
      inv[0][0]*t[0] + inv[0][1]*t[1] + inv[0][2]*t[2],
      inv[1][0]*t[0] + inv[1][1]*t[1] + inv[1][2]*t[2],
      inv[2][0]*t[0] + inv[2][1]*t[1] + inv[2][2]*t[2],
    ];

    // clamp and normalize
    let clamped = w.map(v => Math.max(0, v));
    const sum = clamped.reduce((a, b) => a + b, 0);
    if (sum > 0) clamped = clamped.map(v => v / sum);

    return {
      ratio1: clamped[0],
      ratio2: clamped[1],
      ratio3: clamped[2],
    };
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

  const result = averageQuadrants(snapshot, w, h);
  sendAvg(result);
}

function averageQuadrants(pixels, w, h) {
  const midX = Math.floor(w / 2);
  const midY = Math.floor(h / 2);

  // accumulators: tl, tr, bl, br
  const sums = {
    tl: [0, 0, 0, 0], // r,g,b,count
    tr: [0, 0, 0, 0],
    bl: [0, 0, 0, 0],
    br: [0, 0, 0, 0],
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (x + y * w) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      let q;
      if (x < midX && y < midY) q = "tl";
      else if (x >= midX && y < midY) q = "tr";
      else if (x < midX && y >= midY) q = "bl";
      else q = "br";

      sums[q][0] += r;
      sums[q][1] += g;
      sums[q][2] += b;
      sums[q][3] += 1;
    }
  }

  // compute averages
  const avg = {
    tl: sums.tl[3] ? [sums.tl[0] / sums.tl[3], sums.tl[1] / sums.tl[3], sums.tl[2] / sums.tl[3]] : [0,0,0],
    tr: sums.tr[3] ? [sums.tr[0] / sums.tr[3], sums.tr[1] / sums.tr[3], sums.tr[2] / sums.tr[3]] : [0,0,0],
    bl: sums.bl[3] ? [sums.bl[0] / sums.bl[3], sums.bl[1] / sums.bl[3], sums.bl[2] / sums.bl[3]] : [0,0,0],
    br: sums.br[3] ? [sums.br[0] / sums.br[3], sums.br[1] / sums.br[3], sums.br[2] / sums.br[3]] : [0,0,0],
  };

  return avg;
}

colorPicked = [237, 37, 93];


function setup() {
  window.addEventListener("message", (event) => {
    if (event.data?.type === "updateColor") {
      const { tl, tr, bl, br } = event.data.payload;
      console.log('event data payload', event.data.payload)
      colorPicked = [event.data.payload.rgb[0], event.data.payload.rgb[1], event.data.payload.rgb[2]];
      console.log("Updated colorPicked:", colorPicked);
    }
  });

  pixelDensity(1);
  // if (smallCanvas == true) {
  //   createCanvas(450,450)
  // }
  // else {
  createCanvas(round(windowWidth * 0.98), round(windowHeight * 0.93));
  // }
  background(255);
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

  // fill the arrays with white color
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      paint.push(backgrd, backgrd, backgrd, 0);
    }
  }
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
    mouseIsPressed &&
    mouseX >= 0 &&
    mouseX <= width &&
    mouseY >= 0 &&
    mouseY <= height
  ) {
    let distance = dist(prevMouseX, prevMouseY, mouseX, mouseY);
    let numPoints = floor(distance / 1); // larger number = more gaps and fewer points; these two lines from George Profenza, noted below.
    drawLinePoints(prevMouseX, prevMouseY, mouseX, mouseY, numPoints);

    // add paint when clicking in one place
    if (mouseX == prevMouseX && mouseY == prevMouseY) {
      renderPoints(mouseX, mouseY);
    }
  }
  prevMouseX = mouseX;
  prevMouseY = mouseY;
  // preventing a wrap around error when dragging off canvas and back on
  if (mouseIsPressed && mouseX < 0) {
    prevMouseX = 0;
  }
  if (mouseIsPressed && mouseX > width - 1) {
    prevMouseX = width - 1;
  }
  if (mouseIsPressed && mouseY < 0) {
    prevMouseY = 0;
  }
  if (mouseIsPressed && mouseY > height - 1) {
    prevMouseY = height - 1;
  }
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
      setColor1([colors[activeColor].rgb[0], colors[activeColor].rgb[1], colors[activeColor].rgb[2]]) // need to write a function to convert between types
      //console.log('color1: ', color1)
      iframe.contentWindow.postMessage(
        { type: "updateColor", payload: colors[activeColor] },
        "*"
      );
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "data") {
        const { tl, tr, bl, br } = event.data.payload;
        console.log('tl tr bl br', tl, tr, bl, br)
        //setAvg(avg)

        // console.log('color1: ', color1)
        //const mix_ratio = computeMixRatio(colors[activeColor].rgb!, colors[0].rgb, avg)
        //console.log('mix_ratio: ', mix_ratio)
        //setRatio([mix_ratio['ratioC1'], mix_ratio['ratioC2']]) // this can be used by any input aka any color
        //console.log('3 color mix ratio: ', mix3Colors(pink, blue, white, avg))
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);

  }, [activeColor]);

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
      </div>
    </div>
  );
}
