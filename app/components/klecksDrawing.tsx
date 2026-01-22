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

const BrushPreview = forwardRef<KlecksDrawingRef, DrawingProps>(({ pixelsRef, frameId, smudgeActive }, ref) => {
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
        <script>
          (function() {
            let KL = null;
            let lastBrushSize = 50;
            let brushReady = false;
            const pendingMsgs = [];

            // starting brush params
            let prevSize = 4;
            let prevOpacity = 1;
            let prevScatter = 0;

            let norm_size_change = 0;
            let norm_opacity_change = 0;
            let norm_scatter_change = 0;

            let size_change = 0;
            let opacity_change = 0;
            let scatter_change = 0;

            let newSize = prevSize;
            let newOpacity = prevOpacity;
            let newScatter = prevScatter;

            let smudgingActive = false;

            let prevPixels = new Uint8ClampedArray(1000).fill(255);

            const {solvePaintRatios, rgb2hsl, interpolate, sigmoid, customSigmoid } = window.ColorSplineUtils;
            const {indexToXY, getPixel, pixel_is_different} = window.PixelUtils;

            // central message handler
            function handleMessage(msg) {
              const inst = KL?.instance;
              if (inst?.klApp?.mobileUi) {
                const ui = inst.klApp.mobileUi;
                ui.toolspaceIsOpen = false;
                // ui.update();
              }

              switch (msg.type) {

                case "smudgingActive":
                  //console.log('smudgingActive received in iframe');
                  smudgingActive = true;
                  break;

                case "smudgingInactive":
                  //console.log('smudgingInactive received in iframe');
                  smudgingActive = false;
                  break;

                case "resetBrushParams":
                  if (KL) {
                    // Reset brush parameters to defaults
                    prevSize = 4;
                    prevOpacity = 1;
                    prevScatter = 0;
                    newSize = 4;
                    newOpacity = 1;
                    newScatter = 0;
                    
                    // Reset change tracking variables
                    size_change = 0;
                    opacity_change = 0;
                    scatter_change = 0;
                    norm_size_change = 0;
                    norm_opacity_change = 0;
                    norm_scatter_change = 0;
                    
                    // Reset prevPixels to cleared canvas state (all white)
                    if (prevPixels && prevPixels.length > 0) {
                      prevPixels = new Uint8ClampedArray(prevPixels.length).fill(255);
                    }
                    
                    // Apply the reset values to Klecks
                    KL.setBrushSize(4);
                    KL.setBrushOpacity(1);
                    KL.setBrushScatter(0);
                    
                    console.log('reset values in klecksdrawing iframe')
                  }
                  break;

                case "updatePixels":
                  window.pixels = msg.payload.pixelsRef.current;

                  if (!pixels || !prevPixels || pixels.length !== prevPixels.length) {
                    if (pixels && pixels.length > 0) {
                      prevPixels = new Uint8ClampedArray(pixels);
                    }
                    return;
                  }
                            
                  for (let i = 0; i < pixels.length; i += 4) {
                    const {x,y} = indexToXY(i, 500); // because array is 500x500x4

                    let curr_pixel = getPixel(pixels, 500, x, y);
                    let prev_pixel = getPixel(prevPixels, 500, x, y);

                    if (pixel_is_different(prev_pixel, curr_pixel)) {
                      //let location_value = customSigmoid(x,y);

                      let curr_ratio = solvePaintRatios(curr_pixel['r'], curr_pixel['g'], curr_pixel['b'])
                      let prev_ratio = solvePaintRatios(prev_pixel['r'], prev_pixel['g'], prev_pixel['b'])
                      //console.log(curr_ratio, prev_ratio)

                      let ratio_diff_red = curr_ratio['red'] - prev_ratio['red']
                      let ratio_diff_yellow = curr_ratio['yellow'] - prev_ratio['yellow']
                      let ratio_diff_blue = curr_ratio['blue'] - prev_ratio['blue']

                      //console.log('smudgingActive', smudgingActive)
                      if (smudgingActive) {
                        ratio_diff_red = ratio_diff_red * -1
                        ratio_diff_yellow = ratio_diff_yellow * -1
                        ratio_diff_blue = ratio_diff_blue * -1
                      }

                      size_change += ratio_diff_red
                      opacity_change += ratio_diff_yellow
                      scatter_change += ratio_diff_blue
                    }
                  }
                  
                  console.log('change', size_change, opacity_change, scatter_change)
                  
                  norm_size_change = size_change / pixels.length * 1000;
                  norm_opacity_change = opacity_change / pixels.length * 100;
                  norm_scatter_change = scatter_change / pixels.length * 500;
                  
                  console.log('normalized changes', norm_size_change, norm_opacity_change, norm_scatter_change)
                  console.log('prevsize opacity scatter', prevSize, prevOpacity, prevScatter)
                  
                  newSize = (prevSize + norm_size_change);
                  newOpacity = prevOpacity - norm_opacity_change;
                  newScatter = Math.max(0,prevScatter + norm_scatter_change);

                  console.log('new params', newSize, newOpacity, newScatter)

                  KL.setBrushSize(newSize) // since klecks doubles the size for some reason
                  KL.setBrushOpacity(newOpacity) // opacity ranges from 0-1, same size
                  KL.setBrushScatter(newScatter); // scatter ranges from 0-1, same size

                  let brush_color = KL.getBrushColor();
                  console.log('brush color', brush_color)
                  
                  // Broadcast brush color change to parent window
                  if (brush_color) {
                    window.parent.postMessage({ 
                      type: "brushColorChanged", 
                      payload: brush_color 
                    }, "*");
                  }

                  prevSize = newSize;
                  prevOpacity = newOpacity;
                  prevScatter = newScatter;
                  
                // Copy the array, don't assign a reference!
                prevPixels = new Uint8ClampedArray(pixels);
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
                onSubmit: (success) => success(),
                onGetPenBrushSize: () => lastBrushSize,
                //onDraw: (path) => {}
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

              console.log('KL', KL)
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
