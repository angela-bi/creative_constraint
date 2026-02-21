import React, { useEffect, useRef, forwardRef, useImperativeHandle, SetStateAction } from "react";
import { Color, RGB } from "../session/[participantId]/page";

type DrawingProps = {
  pixelsRef: React.RefObject<Uint8ClampedArray | null>;
  frameId: number;
  // soundLevel: number;
  //setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export type KlecksDrawingRef = {
  getBrushSize: () => Promise<number | null>;
  setBrushSize: (size: number) => void;
  
};

const BrushPreview = forwardRef<KlecksDrawingRef, DrawingProps>(({ pixelsRef, frameId }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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


  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "smudgingActive") {
        console.log('smudgingActive received in klecksDrawing');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "smudgingActive" }, "*");
      }
      if (event.data?.type === "smudgingInactive") {
        console.log('smudgingInactive received in klecksDrawing');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "smudgingInactive" }, "*");
      }
      if (event.data?.type === "resetBrushParams") {
        // console.log('resetBrushParams received in klecksDrawing');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "resetBrushParams" }, "*");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "brushColorChanged") {
        // Forward the brush color to the iframe
        iframeRef.current?.contentWindow?.postMessage({ 
          type: "setBrushColor", 
          payload: event.data.payload 
        }, "*");
      }
      if (event.data?.type === "smudgingActive") {
        console.log('smudgingActive received in brushPreview');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "smudgingActive" }, "*");
      }
      if (event.data?.type === "resetBrushParams") {
        // console.log('resetBrushParams received in brushPreview');
        // Forward the message to the iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "resetBrushParams" }, "*");
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
          /* Hide the tool sidebar completely */
          .kl-toolbar {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
          }
          .kl-toolspace {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
          }
          /* Additional selectors for iPad/mobile */
          .kl-toolbar,
          .kl-toolspace,
          [class*="toolbar"],
          [class*="toolspace"],
          [class*="kl-toolbar"],
          [class*="kl-toolspace"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
          }
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
              // Always try to hide toolbar when handling messages
              Utils.hideToolbar(KL);
              
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
                  if (KL) {
                    KL.hideToolSpace();
                  }
                  syncFromBrushState();
                  break;

                case "updatePixels":
                  window.pixels = msg.payload.pixelsRef.current;
                  
                  Utils.processPixelChanges(window.pixels, brushState, KL, {
                    normalization: { size: 1200, opacity: 30, scatter: 300 },
                    smudgeMultiplier: -1.2,
                    onUpdate: (state) => {
                      syncFromBrushState();
                      
                      // Component-specific: hide toolspace and draw preview path
                      if (KL) {
                        KL.hideToolSpace();
                        
                        const inst = KL.instance;
                        const app = inst.klApp;
                        
                        const path = [];
                        const xStart = 200;
                        const yStart = 0;
                        let yCurrent = yStart;
                        
                        for (let i = 0; i < 11; i++) {
                          path.push({x: xStart, y: yCurrent});
                          yCurrent = yCurrent + 100;
                        }
                        
                        KL.clearLayer();
                        KL.draw(path);
                      }
                      
                      console.log('new params preview', newSize, newOpacity, newScatter);
                    }
                  });
                  break;
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

            // Setup toolbar hiding using utility
            Utils.setupToolbarHiding(KL, 50);

            // load Klecks script and initialize KL
            const script = document.createElement('script');
            script.src = '${origin}/klecks/embed.js';
            script.onload = () => {
              KL = new Klecks({
                onSubmit: (success) => success(),
                onGetPenBrushSize: () => lastBrushSize,
                //onDraw: (path) => {}
              });

              KL.openProject({
                width: 400,
                height: 1000,
                layers: [
                  {
                    name: "Background",
                    isVisible: true,
                    opacity: 1,
                    mixModeStr: "source-over",
                    image: { fill: "#ffffff" }
                  }
                ]
              });

              // Close toolspace on initialization
              setTimeout(() => {
                const inst = KL.instance;
                if (inst?.klApp?.mobileUi) {
                  inst.klApp.mobileUi.toolspaceIsOpen = false;
                }
                Utils.hideToolbar(KL);
              }, 50);

              // Keep hiding it after project opens (more frequent for iPad)
              setTimeout(() => Utils.hideToolbar(KL), 100);
              setTimeout(() => Utils.hideToolbar(KL), 200);
              setTimeout(() => Utils.hideToolbar(KL), 500);
              setTimeout(() => Utils.hideToolbar(KL), 1000);
              setTimeout(() => Utils.hideToolbar(KL), 2000);
              setTimeout(() => Utils.hideToolbar(KL), 3000);
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

    return () => URL.revokeObjectURL(url);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: "100%", height: "100%", border: "1px solid gray", borderRadius: "12px" }}
    />
  );
});

export default BrushPreview;
