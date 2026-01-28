import React, { useEffect, useRef, forwardRef, useImperativeHandle, SetStateAction } from "react";
import { Color, RGB } from "../page";

type DrawingProps = {
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
        console.log('resetBrushParams received in klecksDrawing');
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

                case "updatePixels":
                  window.pixels = msg.payload.pixelsRef.current;
                  
                  console.log('KL inside klecksdrawing', KL)
                  Utils.processPixelChanges(window.pixels, brushState, KL, {
                    normalization: { size: 1200, opacity: 30, scatter: 300 },
                    smudgeMultiplier: -1.2,
                    onUpdate: (state) => {
                      syncFromBrushState();
                      
                      // Component-specific: broadcast brush color
                      let brush_color = KL.getBrushColor();
                      console.log('brush color', brush_color);
                      console.log('new params drawing software', newSize, newOpacity, newScatter);
                      
                      if (brush_color) {
                        window.parent.postMessage({ 
                          type: "brushColorChanged", 
                          payload: brush_color 
                        }, "*");
                      }
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
                      console.log('psd', psd)
                      console.log('PSD data type:', typeof psd, psd);
                      console.log('PSD constructor:', psd?.constructor?.name);
                      //downloadFile(psd, 'drawing.psd', 'application/octet-stream');
                    }
                    
                    // Download PNG file
                    if (png) {
                      // PNG might be a data URL or blob, handle both cases
                      if (typeof png === 'string' && png.startsWith('data:')) {
                        // It's a data URL, convert to blob
                        fetch(png)
                          .then(res => res.blob())
                          .then(blob => {
                            //downloadFile(blob, 'drawing.png', 'image/png');
                          });
                      } else {
                        // It's already a blob
                        //downloadFile(png, 'drawing.png', 'image/png');
                      }
                    }
                    
                    success();
                  }).catch(error => {
                    console.error('Error getting files:', error);
                    success(); // Still call success to close the dialog
                  });
                },
              });

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
                  }
                ]
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
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: "100%", height: "100%", border: "1px solid gray", borderRadius: "12px" }}
    />
  );
});

export default BrushPreview;
