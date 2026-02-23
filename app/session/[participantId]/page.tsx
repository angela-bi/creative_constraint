"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import JSZip from "jszip";

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
    { saveType: "manual" | "auto" | "switch",
      timestamp: number,
      klecks?: string,
      watercolor?: string }
  >>({});

  type ZipPending = {
    psd: ArrayBuffer | null;
    klecksPng: ArrayBuffer | null;
    watercolorCount: number | null;
    watercolors: Record<number, ArrayBuffer>;
  };
  const pendingZipRef = useRef<Record<string, ZipPending>>({});

  const tryBuildZip = useCallback(async (zipRequestId: string) => {
    const p = pendingZipRef.current[zipRequestId];
    if (!p) return;
    const { psd, klecksPng, watercolorCount, watercolors } = p;
    if (!psd || !klecksPng || watercolorCount === null) return;
    const received = Object.keys(watercolors).length;
    if (received !== watercolorCount) return;

    delete pendingZipRef.current[zipRequestId];
    const zip = new JSZip();
    zip.file("klecks.psd", psd);
    zip.file("klecks.png", klecksPng);
    for (let i = 0; i < watercolorCount; i++) {
      const buf = watercolors[i];
      if (buf) zip.file(`watercolor-${i}.png`, buf);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drawing-${zipRequestId.replace("zip-", "")}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

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

  const TWENTY_MINUTES = 10 * 60 * 1000;
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
  
      if (sessionId && now - lastActivityRef.current > TWENTY_MINUTES) { // has the user done something in the last ____________?
        await fetch("/api/end-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        logEvent("session_ended", { reason: "inactivity" });
  
        setSessionId(null);
      }
    }, HALF_MINUTE); // checking this every ________
  
    return () => clearInterval(interval);
  }, [sessionId]);

  // autosave
  useEffect(() => {
    if (!sessionId) return;
  
    const interval = setInterval(() => {
      const now = Date.now();
  
      const userIsActive = now - lastActivityRef.current < TWENTY_MINUTES; // has the user done something in the last _________?
      const enoughTimeSinceLastSave = now - lastSaveRef.current > TEN_MINUTES; // has it been __________ since the last save?
  
      if (userIsActive && enoughTimeSinceLastSave) {
        console.log('autosaving')
        logEvent('autosaving')
        triggerFullSave(true);
      }
    }, HALF_MINUTE); // checking this every _________
  
    return () => clearInterval(interval);
  }, [sessionId]);

  // SAVING

  const triggerFullSave = useCallback((isAuto: boolean) => {
    if (!sessionId) return;
  
    const saveId = crypto.randomUUID();
    const timestamp = Date.now();
  
    autoSaveRef.current = isAuto;
    lastSaveRef.current = Date.now();
  
    saveBufferRef.current[saveId] = {
      saveType: isAuto ? "auto" : "manual",
      timestamp,
    };
  
    window.postMessage({
      type: "saveCanvas",
      payload: { saveId: saveId, isAuto: isAuto }
    }, "*");
    //console.log('savecanvas in page.tsx sent')
  }, [sessionId]);

  const savePostRequest = async (saveId: string, isAuto: boolean) => {
    const buffer = saveBufferRef.current[saveId];
    if (!buffer) return;
  
    const timestamp = Date.now();
  
    try {
      if (buffer.klecks) {
        await fetch("/api/save-klecks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            klecksPNG: buffer.klecks,
            participantId,
            sessionId,
            timestamp,
          }),
        });
      }
  
      if (buffer.watercolor) {
        const res = await fetch("/api/save-watercolor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            watercolorPNG: buffer.watercolor,
            participantId,
            sessionId,
            timestamp,
          }),
        });
        
        const savedWatercolor = await res.json();
        // console.log("Saved watercolor record:", savedWatercolor);
        if (isAuto && savedWatercolor?.id) {
          logEvent("canvas_autosaved", {
            canvasId: savedWatercolor.id,
            signedUrl: savedWatercolor.signedUrl,
          });
        }
        window.postMessage({
          type: "watercolorSavedToDB",
          payload: {
            newRecord: savedWatercolor,
            isAuto
          }
        }, "*");
      }
  
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      delete saveBufferRef.current[saveId];
    }
  };

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type === "savetoDBwatercolor") {
        const { watercolorPNG, saveId, isAuto } = event.data.payload;
        const buffer = saveBufferRef.current[saveId];
        // console.log('buffer', buffer)
        if (!buffer) return;
      
        buffer.watercolor = watercolorPNG;
      
        if (buffer.klecks) {
          savePostRequest(saveId, isAuto);
        }
      }
      
      if (event.data?.type === "savetoDBklecks") {
        const { klecksPNG, saveId, isAuto } = event.data.payload;
        const buffer = saveBufferRef.current[saveId];
        if (!buffer) return;
      
        buffer.klecks = klecksPNG;
      
        savePostRequest(saveId, isAuto)
      }

      if (event.data?.type === "canvasCleared") {
        logEvent("canvas_cleared");
      }

      if (event.data?.type === "canvasSwitched") {
        const { canvasId, signedUrl } = event.data.payload;
        logEvent("canvas_switched", { canvasId: canvasId, signedUrl: signedUrl });
        // triggerFullSave(true);
      }

      // if (event.data?.type === "watercolorCheckpointReady") {
      //   const { saveId } = event.data.payload;
      
      //   const buffer = saveBufferRef.current[saveId];
      //   if (!buffer) return;
      
      //   buffer.watercolor = "CHECKPOINT"; // placeholder
      
      //   if (buffer.watercolor && buffer.klecks) {
      //     savePostRequest(saveId);
      //   }
      // }

      if (event.data?.type === "saveCanvasButtonPressed") {
        triggerFullSave(false);
        logEvent("save_canvas_button_pressed");
      }

      if (event.data?.type === "zipPsd") {
        const { zipRequestId, buffer } = event.data;
        if (!zipRequestId || !buffer) return;
        if (!pendingZipRef.current[zipRequestId]) {
          pendingZipRef.current[zipRequestId] = {
            psd: null,
            klecksPng: null,
            watercolorCount: null,
            watercolors: {},
          };
        }
        pendingZipRef.current[zipRequestId].psd = buffer;
        tryBuildZip(zipRequestId);
      }
      if (event.data?.type === "zipKlecksPng") {
        const { zipRequestId, buffer } = event.data;
        if (!zipRequestId || !buffer) return;
        if (!pendingZipRef.current[zipRequestId]) {
          pendingZipRef.current[zipRequestId] = {
            psd: null,
            klecksPng: null,
            watercolorCount: null,
            watercolors: {},
          };
        }
        pendingZipRef.current[zipRequestId].klecksPng = buffer;
        tryBuildZip(zipRequestId);
      }
      if (event.data?.type === "watercolorZipCount") {
        const { zipRequestId, count } = event.data;
        if (!zipRequestId || count == null) return;
        if (!pendingZipRef.current[zipRequestId]) {
          pendingZipRef.current[zipRequestId] = {
            psd: null,
            klecksPng: null,
            watercolorCount: null,
            watercolors: {},
          };
        }
        pendingZipRef.current[zipRequestId].watercolorCount = count;
        tryBuildZip(zipRequestId);
      }
      if (event.data?.type === "watercolorZipBlob") {
        const { zipRequestId, index, buffer } = event.data;
        if (!zipRequestId || buffer == null) return;
        if (!pendingZipRef.current[zipRequestId]) return;
        pendingZipRef.current[zipRequestId].watercolors[index] = buffer;
        tryBuildZip(zipRequestId);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sessionId, participantId, tryBuildZip]);  
  
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
