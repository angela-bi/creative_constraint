import React, { useEffect, useRef, useState } from "react";
import { RGB, Color, Ratio } from "../page";

type DrawingProps = {
  ratio: Ratio;
  setRatio: React.Dispatch<React.SetStateAction<Ratio>>;
  colors: Color[];
};

export default function DrawingSoftware({ ratio, setRatio, colors }: DrawingProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // listening for ratio
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
  
    const sendRatio = () => {
      iframe.contentWindow?.postMessage(
        { type: "updateRatio", payload: { ratio } },
        "*"
      );
    };
  
    // Send after iframe is ready
    const handleLoad = () => {
      sendRatio();
    };
  
    iframe.addEventListener("load", handleLoad);
  
    // Also send again when ratio changes (after iframe is loaded)
    if (iframe.contentWindow) {
      sendRatio();
    }
  
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [ratio]);  

  // audio
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let rafId: number;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        analyser!.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length); // volume between 0 and ~0.2 typical

        // Send volume to p5 sketch as brush size
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: "updateBrushSize",
              payload: { rms },
            },
            "*"
          );
        }

        rafId = requestAnimationFrame(tick);
      };
      tick();
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      audioCtx?.close();
      source?.disconnect();
    };
  }, []);

  // iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const code = `
let brushSize = 15;
let ratio = [1, 0];
let myPicker, sizeSlider;

window.addEventListener("message", (event) => {
  if (event.data?.type === "updateRatio") {
    ratio = event.data.payload.ratio; // e.g. [0.6, 0.4]
  }

  if (event.data?.type === "updateBrushSize") {
    const { rms } = event.data.payload;
    const soundInfluence = 10 + rms * 400; // base sound-driven size
    brushSize = ratio[0] * brushSize + ratio[1] * soundInfluence;
    console.log("ratio: ", ratio)
    console.log("brushSize:", brushSize);
  }
});

function setup() {
  createCanvas(1000, 1000);
  text('brush color', 0, 490);
  myPicker = createColorPicker('rgb(0,0,0)');
  myPicker.position(0, 500);
}

let f = 0;
let spring = 0.4;
let friction = 0.45;
let v = 0.5;
let r = 0;
let vx = 0;
let vy = 0;
let splitNum = 100;
let diff = 2;
let x, y, oldX, oldY, oldR;

function draw() {
  if (mouseIsPressed) {
    if (!f) {
      f = true;
      x = mouseX;
      y = mouseY;
    }
    vx += (mouseX - x) * spring;
    vy += (mouseY - y) * spring;
    vx *= friction;
    vy *= friction;
    
    v += sqrt(vx * vx + vy * vy) - v;
    v *= 0.55;

    oldR = r;
    r = brushSize - v;
    for (let i = 0; i < splitNum; ++i) {
      oldX = x;
      oldY = y;
      x += vx / splitNum;
      y += vy / splitNum;
      oldR += (r - oldR) / splitNum;
      if (oldR < 1) oldR = 1;
      strokeWeight(oldR + diff);
      let c = myPicker.color();
      stroke(c);
      line(x + random(0, 2), y + random(0, 2), oldX + random(0, 2), oldY + random(0, 2));
      strokeWeight(oldR);
      line(x + diff * random(0.1, 2), y + diff * random(0.1, 2), oldX + diff * random(0.1, 2), oldY + diff * random(0.1, 2));
      line(x - diff * random(0.1, 2), y - diff * random(0.1, 2), oldX - diff * random(0.1, 2), oldY - diff * random(0.1, 2));
    }
  } else if (f) {
    vx = vy = 0;
    f = false;
  }
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
          canvas { display: block; }
        </style>
      </head>
      <body>
        <script>
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

    return () => {
      URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <iframe
      sandbox="allow-scripts allow-same-origin"
      ref={iframeRef}
      style={{
        width: "100%",
        height: "550px",
        border: "1px solid gray",
        borderRadius: "12px",
        padding: "10px"
      }}
    />
  );
}
