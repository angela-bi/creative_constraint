import React, { useEffect, useRef, forwardRef, useImperativeHandle, SetStateAction } from "react";
import { Color, RGB } from "../session/[participantId]/page";

type DrawingProps = {
  participantId: string
  pixelsRef: React.RefObject<Uint8ClampedArray | null>;
  frameId: number;
  smudgeActive: boolean;
  // soundLevel: number;
  //setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export type KlecksDrawingRef = {
  getBrushSize: () => Promise<number | null>;
  setBrushSize: (size: number) => void;
};

const BrushPreview = forwardRef<KlecksDrawingRef, DrawingProps>(({ pixelsRef, frameId, participantId }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [startupMode, setStartupMode] = React.useState<"idle" | "chosen">("idle");

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getBrushSize: () => {
      return new Promise<number | null>(resolve => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return resolve(null);

        const requestId = `${Date.now()}-${Math.random()}`;

        const handler = (ev: MessageEvent) => {
          if (ev.data?.type === "brushSizeResponse" && ev.data.requestId === requestId) {
            window.removeEventListener("message", handler);
            resolve(ev.data.size ?? null);
          }
        };

        window.addEventListener("message", handler);
        iframe.contentWindow.postMessage({ type: "getBrushSize", requestId }, "*");

        // Timeout fallback
        setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve(null);
        }, 3000);
      });
    },
    setBrushSize: (size: number) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "setBrushSize", size }, "*");
    },
  }));

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: "updatePixels", payload: { pixelsRef } }, "*");
  }, [frameId]);

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }  

  function ImportPSDButton({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement> }) {
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
  
      if (!file.name.toLowerCase().endsWith(".psd")) {
        alert("Please select a PSD file");
        return;
      }
  
      const reader = new FileReader();
      reader.onload = () => {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "importPSD",
            buffer: reader.result
          },
          "*"
        );
      };
  
      reader.readAsArrayBuffer(file);
  
      // Reset input so same file can be selected again
      e.target.value = "";
    };
  
    return (
      <label>
        Import PSD
        <input
          type="file"
          accept=".psd"
          onChange={onFileChange}
          hidden
        />
      </label>
    );
  }
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "smudgingActive") {
        //console.log('smudgingActive received in klecksDrawing');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "smudgingActive" }, "*");
      }
      if (event.data?.type === "smudgingInactive") {
        //console.log('smudgingInactive received in klecksDrawing');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "smudgingInactive" }, "*");
      }
      if (event.data?.type === "resetBrushParams") {
        // console.log('resetBrushParams received in klecksDrawing');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "resetBrushParams" }, "*");
      }
      if (event.data?.type === "exportPSD") {
        const { psd, timestamp } = event.data.payload;
        downloadBlob(psd, `drawing-${timestamp}.psd`);
        // Request watercolor canvas save so it's added to Sketch's savedCanvases
        window.postMessage({ type: "requestWatercolorSave" }, "*");
      }
      if (event.data?.type === "saveCanvas") { // sent from user pressing saveCanvas button
        const { saveId, isAuto } = event.data?.payload

        iframeRef.current?.contentWindow?.postMessage(
          // asking for klecks pnd
          {
            type: "klecksPNGrequest",
            payload: {
              // klecksPNG: canvas,
              saveId: saveId,
              participantId: participantId
            }
          },
          "*"
        );
      }
      if (event.data?.type === "klecksPNGresponse") { // response back from klecks
        const { png, saveId } = event.data.payload;
        window.postMessage({
          type: "savetoDBklecks",
          payload: {
            klecksPNG: png,
            saveId: saveId
          }
        }, "*");
      }
      if (event.data?.type === "exportDrawingPNG") {
        const { png, timestamp } = event.data.payload;
        downloadBlob(png, `drawing-${timestamp}.png`);
        // Request watercolor canvas save so it's added to Sketch's savedCanvases
        window.postMessage({ type: "requestWatercolorSave" }, "*");
      }
      if (event.data?.type === "exportCanvas") {
        const timestamp = event.data.payload;
      
        window.postMessage({
          type: "requestWatercolorPNG",
          payload: { timestamp }
        }, "*");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);


  // Inject Klecks into iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const origin = window.location.origin;
    const html = `
      <!DOCTYPE html>
      <html lang="en" class="klecks-drawing">
      <head>
        <meta charset="UTF-8">
        <title>Klecks</title>
        <style>
        </style>
      </head>
      <body style="margin:0; overflow:hidden;">
        <script src="${origin}/utils/bezier-spline.js"></script>
        <script src="${origin}/utils/color-spline-utils.js"></script>
        <script src="${origin}/utils/pixel-utils.js"></script>
        <script src="${origin}/utils/drawing-software-utils.js"></script>
        <script>
          (function() {
            let KL = null;
            let projectOpened = false;
            let pendingStartup = null; // { type: "new" } | { type: "psd", buffer }
            let lastBrushSize = 50;
            let brushReady = false;
            const pendingMsgs = [];

            const Utils = window.DrawingSoftwareUtils;
            
            // Initialize brush state using utility
            const brushState = Utils.initBrushState();
            
            // Use state variables (keeping compatibility with existing code)
            let prevSize = brushState.prevSize;
            let prevOpacity = brushState.prevOpacity;
            let prevScatter = brushState.prevScatter;
            let newSize = brushState.newSize;
            let newOpacity = brushState.newOpacity;
            let newScatter = brushState.newScatter;
            let smudgingActive = brushState.smudgingActive;
            let prevPixels = brushState.prevPixels;

            // Update brushState from local variables (sync helper)
            function syncBrushState() {
              brushState.prevSize = prevSize;
              brushState.prevOpacity = prevOpacity;
              brushState.prevScatter = prevScatter;
              brushState.newSize = newSize;
              brushState.newOpacity = newOpacity;
              brushState.newScatter = newScatter;
              brushState.smudgingActive = smudgingActive;
              brushState.prevPixels = prevPixels;
            }
            
            // Update local variables from brushState (sync helper)
            function syncFromBrushState() {
              prevSize = brushState.prevSize;
              prevOpacity = brushState.prevOpacity;
              prevScatter = brushState.prevScatter;
              newSize = brushState.newSize;
              newOpacity = brushState.newOpacity;
              newScatter = brushState.newScatter;
              smudgingActive = brushState.smudgingActive;
              prevPixels = brushState.prevPixels;
            }

            // central message handler
            function handleMessage(msg) {
              const inst = KL?.instance;
              if (inst?.klApp?.mobileUi) {
                const ui = inst.klApp.mobileUi;
                ui.toolspaceIsOpen = false;
              }
              
              syncBrushState(); // Sync before processing

              switch (msg.type) {
                case "smudgingActive":
                  brushState.smudgingActive = true;
                  syncFromBrushState();
                  break;

                case "smudgingInactive":
                  brushState.smudgingActive = false;
                  syncFromBrushState();
                  break;

                case "resetBrushParams":
                  Utils.resetBrushParams(brushState, KL);
                  syncFromBrushState();
                  break;

                case "importPSD": {
                  if (projectOpened) return;

                  if (!KL) {
                    pendingStartup = { type: "psd", buffer: msg.buffer };
                    return;
                  }

                  projectOpened = true;
                  KL.openPSD(msg.buffer);
                  break;
                }

                case "createNewProject": {
                  if (projectOpened) return;

                  if (!KL) {
                    pendingStartup = { type: "new" };
                    return;
                  }

                  projectOpened = true;
                  KL.openProject({
                    width: 1000,
                    height: 1000,
                    layers: [
                      {
                        name: "Background",
                        isVisible: true,
                        opacity: 1,
                        mixModeStr: "source-over",
                        image: { fill: "#ffffff" }
                      },
                      {
                        name: "Layer 1",
                        isVisible: true,
                        opacity: 1,
                        mixModeStr: "source-over",
                        image: { fill: "#ffffff" }
                      }
                    ]
                  });
                  break;
                }

                case "updatePixels":
                  window.pixels = msg.payload.pixelsRef.current;
                  
                  //console.log('KL inside klecksdrawing', KL)
                  Utils.processPixelChanges(window.pixels, brushState, KL, {
                    normalization: { size: 1200, opacity: 30, scatter: 300 },
                    smudgeMultiplier: -1.2,
                    onUpdate: (state) => {
                      syncFromBrushState();
                      
                      // Component-specific: broadcast brush color
                      let brush_color = KL.getBrushColor();
                      //console.log('brush color', brush_color);
                      //console.log('new params drawing software', newSize, newOpacity, newScatter);
                      
                      if (brush_color) {
                        window.parent.postMessage({ 
                          type: "brushColorChanged", 
                          payload: brush_color 
                        }, "*");
                      }
                    }
                  });
                  break;

                case "klecksPNGrequest": {
                  const { saveId, participantId } = msg.payload;

                  const blobToDataURL = (blob) => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  });

                  KL.getPNG().then(async (png) => {
                    const dataUrl = png instanceof Blob ? await blobToDataURL(png) : (typeof png === "string" ? png : null);
                    if (!dataUrl) return;
                    window.parent.postMessage(
                      {
                        type: "klecksPNGresponse",
                        payload: {
                          png: dataUrl,
                          saveId: saveId
                        }
                      },
                      "*"
                    );
                  });

                  break;
                }

              }
            }

            // message listener: queue until ready
            window.addEventListener('message', (event) => {
              const msg = event.data;
              if (!msg || typeof msg !== 'object') return;

              // if brush not installed yet, queue messages that affect brush
              const requiresReady = ['setBrushSize', 'setBrushOpacity', 'getBrushSize', 'updateAvg'];
              if (!brushReady && requiresReady.includes(msg.type)) {
                pendingMsgs.push(msg);
                return;
              }
              handleMessage(msg);
            });

            // load Klecks script and initialize KL
            const script = document.createElement('script');
            script.src = '${origin}/klecks/embed.js';
            script.onload = () => {
              KL = new Klecks({
                onSubmit: (success) => {
                  Promise.all([
                    KL.getPSD(),
                    KL.getPNG()
                  ]).then(([psd, png]) => {
                    // Download PSD file
                    if (psd) {
                      window.parent.postMessage({
                        type: "exportPSD",
                        payload: {
                          psd,
                          timestamp: Date.now()
                        }
                      }, "*");
                    }

                    // ask sketch canvas to download current canvas
                    window.parent.postMessage({
                        type: "exportCanvas",
                        payload: {
                          timestamp: Date.now()
                        }
                    }, "*");

                    // console.log('png onsubmit', png)
                    // Download PNG file
                    if (png) {
                      window.parent.postMessage({
                        type: "exportDrawingPNG",
                        payload: {
                          png,
                          timestamp: Date.now()
                        }
                      }, "*");
                    }
                    
                    success();
                  }).catch(error => {
                    console.error('Error getting files:', error);
                    success(); // Still call success to close the dialog
                  });
                },
              });
            };
            document.head.appendChild(script);

          })();
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    const style = document.createElement("style");
    style.textContent = `
        /* Move tool sidebar to the right */
        .kl-toolbar {
            left: auto !important;
            right: 0 !important;
        }

        /* Move the inner content so it doesnt overlap */
        .kl-app {
            flex-direction: row-reverse !important;
        }
    `;
    document.head.appendChild(style);

    return () => URL.revokeObjectURL(url);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {startupMode === "idle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            background: "rgba(255,255,255,0.95)",
          }}
        >
          <button
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: "createNewProject" },
                "*"
              );
              setStartupMode("chosen");
            }}
          >
            New Project
          </button>
  
          <label>
            Open PSD
            <input
              type="file"
              accept=".psd"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
  
                const reader = new FileReader();
                reader.onload = () => {
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: "importPSD", buffer: reader.result },
                    "*"
                  );
                  setStartupMode("chosen");
                };
                reader.readAsArrayBuffer(file);
              }}
            />
          </label>
        </div>
      )}
  
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: "100%",
          height: "90dvh",
          border: "1px solid gray",
          borderRadius: "12px",
        }}
      />
    </div>
  );  
});

export default BrushPreview;
