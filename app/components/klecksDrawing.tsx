"use client";

import React, { useEffect, useRef } from "react";
import { Ratio } from "../page";

interface KlecksDrawingProps {
  ratio: Ratio;
  psdURL?: string; // optional PSD file in public/
  width?: number;
  height?: number;
}

export default function KlecksDrawing({
  ratio,
  psdURL,
  width = 500,
  height = 500,
}: KlecksDrawingProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const setBrushSize = (size: number) => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "setBrushSize",
      size,
    }, "*");
  };

  function drawLineInKlecks() {
    const points = [
      { x: 10, y: 10 },
      { x: 200, y: 200 }
    ];
    iframeRef.current?.contentWindow?.postMessage(
      { type: "draw", points },
      "*"
    );
  }

  // listening for ratio
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // console.log('testing drawline')
    // drawLineInKlecks();

    // console.log('testing setbrushsize');
    // setBrushSize(100);
  
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

  useEffect(() => {
    if (!iframeRef.current) return;
    
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="http://localhost:55443" 
      style={{ width: "100%", height: "100%", border: "none" }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
