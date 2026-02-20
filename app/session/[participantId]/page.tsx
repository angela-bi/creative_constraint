"use client";

import { useEffect, useCallback, useState, useRef } from "react";

import BrushPreview from "../../components/brushPreview";
import KlecksDrawing from "../../components/klecksDrawing";
import Sketch from "../../components/sketch";
import HSLHistograms from "../../components/HSLHistograms";

import { useParams } from "next/navigation";

// export type Ratio = [number, number, number]

export type RGB = [number, number, number]; // each 0–255
export type Color = {name: string, rgb: RGB}

export default function HomePage() {
  const params = useParams();
const participantId = params?.participantId as string;

  const pixelsRef = useRef<Uint8ClampedArray | null>(null);
  const [frameId, setFrameId] = useState(0);
  const [smudgeActive, setsmudgeActive] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const white: Color = {name: 'white', rgb: [255, 255, 255]};
  const black: Color = {name: 'black', rgb: [0, 0, 0]};
  const pink: Color = {name: 'pink', rgb: [266, 0, 168]};
  const navy: Color = {name: 'blue', rgb: [0, 0, 255]};
  const gray: Color = {name: 'gray', rgb: [210, 210, 210]};
  const red: Color = {name: 'pink', rgb: [255, 0, 0]};
  const green: Color = {name: 'green', rgb: [0, 255, 0]};
  const blue: Color = {name: 'blue', rgb: [0, 0, 255]}
  const orange: Color = {name: 'orange', rgb: [255, 92, 0]}
  const yellow: Color = {name: 'yellow', rgb: [255, 255, 0]}
  const purple: Color = {name: 'purple', rgb: [148, 0, 211]}
  const colors = [pink, orange, yellow, green, blue, purple];

  const [activeColor, setActiveColor] = useState<Color>(pink)

  const [pendingSave, setPendingSave] = useState<{
    watercolorPNG?: string;
    klecksPNG?: string;
    timestamp?: string;
    participantId?: string;
  }>({});

  const createSession = async () => {
    const res = await fetch("/api/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        userAgent: navigator.userAgent,
        appVersion: "v1",
      }),
    });
  
    const data = await res.json();
    setSessionId(data.sessionId);
  };

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type === "savetoDBwatercolor") {
        const { watercolorPNG, timestamp, participantId } = event.data.payload;
  
        setPendingSave(prev => ({
          ...prev,
          watercolorPNG,
          timestamp,
          participantId
        }));
      }
  
      if (event.data?.type === "savetoDBklecks") {
        const { klecksPNG, timestamp, participantId } = event.data.payload;
  
        setPendingSave(prev => ({
          ...prev,
          klecksPNG,
          timestamp,
          participantId
        }));
      }
    };
  
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);  

  useEffect(() => {
    if (
      pendingSave.watercolorPNG &&
      pendingSave.klecksPNG &&
      pendingSave.timestamp &&
      pendingSave.participantId
    ) {
      const save = async () => {
        await fetch("/api/save-drawing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pendingSave),
        });
      };
  
      save();
  
      // Reset so it doesn't re-trigger
      setPendingSave({});
    }
  }, [pendingSave]);
  
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("click", updateActivity);
    window.addEventListener("touchstart", updateActivity);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
    };
  }, []);


  // useEffect(() => {
  //   const handler = async (event: MessageEvent) => {
  //     if (event.data?.type === "savetoDBwatercolor") {
  //       const { watercolorPNG, timestamp, participantId } = event.data.payload;
  
  //       await fetch("/api/save-drawing", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           watercolorPNG,
  //           timestamp,
  //           participantId
  //         }),
  //       });
  //     }
  
  //     if (event.data?.type === "savetoDBklecks") {
  //       const { klecksPNG, timestamp, participantId } = event.data.payload;
  
  //       await fetch("/api/save-drawing", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           klecksPNG,
  //           timestamp,
  //           participantId
  //         }),
  //       });
  //     }
  //   };
  
  //   window.addEventListener("message", handler);
  //   return () => window.removeEventListener("message", handler);
  // }, [participantId]);  
  
  return (
    <main style={{ height: "100dvh", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
          width: "100%",
          gap: "20px",
          padding: "24px", // moved from main
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <Sketch
            participantId={participantId}
            pixelsRef={pixelsRef}
            setFrameId={setFrameId}
            colors={colors}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            setSmudgeActive={setsmudgeActive}
          />
        </div>

        <div style={{ flex: 0.5, minHeight: 0 }}>
          <BrushPreview
            pixelsRef={pixelsRef}
            frameId={frameId}
          />
        </div>

        <div style={{ flex: 3, minHeight: 0 }}>
          <KlecksDrawing
            participantId={participantId}
            pixelsRef={pixelsRef}
            frameId={frameId}
            smudgeActive={smudgeActive}
          />
        </div>
      </div>
    </main>
  );
}
