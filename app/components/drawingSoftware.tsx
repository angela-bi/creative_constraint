import React, { useEffect, useRef, useState } from "react";
import { RGB, Color, Ratio } from "../page";

type DrawingProps = {
  ratio: Ratio;
  setRatio: React.Dispatch<React.SetStateAction<Ratio>>;
  colors: Color;
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

  // iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const code = `
function setup() {
  createCanvas(1000, 1000);
  frameRate(100);
  smooth();
}

function draw() {
  
  let brushSize = 10;
  let r = 0;
  let b = 0;
  let g = 0;
  let a = 50;
  
  if (mouseIsPressed) {
    // line from previous to current position
    
    const dx = mouseX - pmouseX;
    const dy = mouseY - pmouseY;
    const steps = max(abs(dx), abs(dy));
    strokeWeight(brushSize);
    stroke(r,g,b,a)
    
    for (let i = 0; i < steps; i++) {
      const x = pmouseX + (dx * i) / steps;
      const y = pmouseY + (dy * i) / steps;
      point(x, y);
    }
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
        height: "100%",
        border: "1px solid gray",
        borderRadius: "12px",
        padding: "10px"
      }}
    />
  );
}
