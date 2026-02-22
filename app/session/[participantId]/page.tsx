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
  const autoSaveRef = useRef(false);
  const lastSaveRef = useRef(0);

  const saveBufferRef = useRef<Record<
    string,
    { watercolor?: string; klecks?: string }
  >>({});

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

  // SESSION STUFF

  // create session
  const createSession = async () => {
    const res = await fetch("/api/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        userAgent: navigator.userAgent,
        appVersion: "v1", //change here when a new version deploys
      }),
    });
  
    const data = await res.json();
    setSessionId(data.sessionId);

    //console.log('session_started')
    await fetch("/api/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: data.sessionId,
        participantId,
        eventType: "session_started",
      }),
    });
  };

  useEffect(() => {
    createSession();
  }, []);

  const TEN_MINUTES = 10 * 60 * 1000;
  const ONE_MINUTE = 60 * 1000;
  const TEN_SECONDS = 10 * 1000;

  const FIVE_MINUTES = 5 * 60 * 1000;
  const HALF_MINUTE = 30 * 1000;

  // close session after inactivity
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      // const tenMinutes = 10 * 60 * 1000;
      // const tenSeconds = 10 * 1000;
  
      //console.log('end_session')
      if (sessionId && now - lastActivityRef.current > ONE_MINUTE) {
        await fetch("/api/end-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        logEvent("session_ended", { reason: "inactivity" });
  
        setSessionId(null);
      }
    }, HALF_MINUTE); // how often we check
  
    return () => clearInterval(interval);
  }, [sessionId]);

  // autosave
  useEffect(() => {
    if (!sessionId) return;
  
    const interval = setInterval(() => {
      const now = Date.now();
  
      const userIsActive = now - lastActivityRef.current < HALF_MINUTE;
      const enoughTimeSinceLastSave = now - lastSaveRef.current > HALF_MINUTE;
  
      if (userIsActive && enoughTimeSinceLastSave) {
        console.log('autosaving')
        triggerFullSave(true);
      }
    }, HALF_MINUTE);
  
    return () => clearInterval(interval);
  }, [sessionId]);

  // SAVING

  const triggerFullSave = useCallback((isAuto: boolean) => {
    if (!sessionId) return;
  
    const saveId = crypto.randomUUID();
  
    autoSaveRef.current = isAuto;
    lastSaveRef.current = Date.now();
  
    saveBufferRef.current[saveId] = {};
  
    window.postMessage({
      type: "saveCanvas",
      payload: { saveId: saveId, isAuto: isAuto }
    }, "*");
    //console.log('savecanvas in page.tsx sent')
  }, [sessionId]);

  const savePostRequest = async (saveId: string) => {
    const buffer = saveBufferRef.current[saveId];
  
    if (!buffer?.watercolor || !buffer?.klecks) return;
  
    try {
      const res = await fetch("/api/save-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watercolorPNG: buffer.watercolor,
          klecksPNG: buffer.klecks,
          participantId,
          timestamp: Date.now(),
        }),
      });
  
      if (!res.ok) {
        console.error("Save failed");
        return;
      }
  
      logEvent("canvas_saved", { auto: autoSaveRef.current });
  
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      delete saveBufferRef.current[saveId];
      autoSaveRef.current = false;
    }
  };

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type === "savetoDBwatercolor") {
        const { watercolorPNG, saveId } = event.data.payload;
      
        const buffer = saveBufferRef.current[saveId];
        if (!buffer) return;
      
        buffer.watercolor = watercolorPNG;
      
        savePostRequest(saveId);
      }
      
      if (event.data?.type === "savetoDBklecks") {
        const { klecksPNG, saveId } = event.data.payload;
      
        const buffer = saveBufferRef.current[saveId];
        if (!buffer) return;
      
        buffer.klecks = klecksPNG;
      
        savePostRequest(saveId);
      }

      if (event.data?.type === "canvasCleared") {
        logEvent("canvas_cleared");
      }

      if (event.data?.type === "manualSaveRequested") {
        //console.log('manualsaverequested in page.tsx')
        triggerFullSave(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sessionId, participantId]);  
  
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

  const logEvent = (
    eventType: string,
    metadata?: Record<string, any>
  ) => {
    if (!sessionId) return;
  
    fetch("/api/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        participantId,
        eventType,
        metadata,
      }),
    }).catch(() => {console.log('error logging event')});
  };
  
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
