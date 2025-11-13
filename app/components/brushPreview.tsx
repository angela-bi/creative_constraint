import React, { useEffect, useRef } from "react";

export default function BrushPreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const code = `
let brushSize = 15;
let ratio = [1, 0];
let rmsSimulated = 0.15;
let spring = 0.4;
let friction = 0.45;
let v = 0.5;
let r = 0;
let vx = 0;
let vy = 0;
let splitNum = 100;
let diff = 2;
let f = false;
let x, y, oldX, oldY, oldR;

// Copy of your brush stroke function
function drawStrokePath(px, py, targetX, targetY) {
  vx += (targetX - px) * spring;
  vy += (targetY - py) * spring;
  vx *= friction;
  vy *= friction;
  
  v += sqrt(vx * vx + vy * vy) - v;
  v *= 0.55;

  oldR = r;
  r = brushSize - v;

  for (let i = 0; i < splitNum; ++i) {
    oldX = px;
    oldY = py;
    px += vx / splitNum;
    py += vy / splitNum;
    oldR += (r - oldR) / splitNum;
    if (oldR < 1) oldR = 1;
    strokeWeight(oldR + diff);
    let c = color(0);
    stroke(c);
    line(px + random(0, 2), py + random(0, 2), oldX + random(0, 2), oldY + random(0, 2));
    strokeWeight(oldR);
    line(px + diff * random(0.1, 2), py + diff * random(0.1, 2), oldX + diff * random(0.1, 2), oldY + diff * random(0.1, 2));
    line(px - diff * random(0.1, 2), py - diff * random(0.1, 2), oldX - diff * random(0.1, 2), oldY - diff * random(0.1, 2));
  }

  return [px, py];
}

// Main simulation
function setup() {
  createCanvas(1000, 400);
  background(255);
  textSize(16);
  textAlign(CENTER);
  text('Original Brush', width * 0.25, 30);
  text('Sound-Influenced Brush', width * 0.75, 30);
  stroke(0);
  noFill();
}

let t = 0;
let x1 = 100;
let y1 = 200;
let x2 = 600;
let y2 = 200;

function draw() {
  // Clear each frame slightly to avoid overdraw clutter
  fill(255, 255, 255, 20);
  noStroke();
  rect(0, 0, width, height);

  // Compute path along a curve (simulate drawing)
  let progress = (t % 300) / 300;
  let targetX = 200 + progress * 300;
  let targetY = 200 + sin(progress * TWO_PI) * 50;

  // === Original Brush ===
  push();
  translate(0, 0);
  brushSize = 15; // fixed for original
  [x1, y1] = drawStrokePath(x1, y1, targetX, targetY);
  pop();

  // === Sound-Influenced Brush ===
  push();
  translate(500, 0);
  // simulate varying sound (sinusoidal rms)
  const rms = 0.1 + 0.1 * sin(t * 0.1);
  const soundInfluence = 10 + rms * 400;
  brushSize = ratio[0] * 15 + ratio[1] * soundInfluence;
  [x2, y2] = drawStrokePath(x2, y2, targetX, targetY);
  pop();

  t++;
}
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
        <style>
          html, body { margin: 0; padding: 0; overflow: hidden; }
          canvas { display: block; margin: auto; }
        </style>
      </head>
      <body>
        <script>
          try {
            ${code}
          } catch (err) {
            document.body.innerHTML = '<pre style="color:red;">' + err + '</pre>';
          }
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    return () => URL.revokeObjectURL(url);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={{
        width: "100%",
        height: "400px",
        border: "1px solid #ccc",
        borderRadius: "12px",
        marginTop: "1rem"
      }}
    />
  );
}
