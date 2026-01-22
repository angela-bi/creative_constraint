import React, { useEffect, useRef, forwardRef, useImperativeHandle, SetStateAction } from "react";
import { Color, RGB } from "../page";

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
      if (event.data?.type === "brushColorChanged") {
        // Forward the brush color to the iframe
        iframeRef.current?.contentWindow?.postMessage({ 
          type: "setBrushColor", 
          payload: event.data.payload 
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
          /* Hide the tool sidebar completely */
          .kl-toolbar {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }
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


            let newSize = prevSize;
            let newOpacity = prevOpacity;
            let newScatter = prevScatter;

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

                case "setBrushColor":
                  if (KL && msg.payload) {
                    try {
                      KL.setBrushColor([msg.payload['r'],msg.payload['g'], msg.payload['b']]);
                    } catch (e) {
                      console.log('Error setting brush color:', e);
                    }
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

                  let size_change = 0;
                  let opacity_change = 0;
                  let scatter_change = 0;
                            
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
                      size_change += ratio_diff_red
                      opacity_change += ratio_diff_yellow
                      scatter_change += ratio_diff_blue
                    }
                  }
                  
                  //console.log('change', size_change, opacity_change, scatter_change)
                  
                  norm_size_change = size_change / pixels.length * 1000;
                  norm_opacity_change = opacity_change / pixels.length * 100;
                  norm_scatter_change = scatter_change / pixels.length * 500;
                  
                  //console.log('normalized changes', norm_size_change, norm_opacity_change, norm_scatter_change)
                  //console.log('prevsize opacity scatter', prevSize, prevOpacity, prevScatter)
                  
                  newSize = (prevSize + norm_size_change);
                  newOpacity = prevOpacity - norm_opacity_change;
                  newScatter = prevScatter + norm_scatter_change;

                  //console.log('new params', newSize, newOpacity, newScatter)

                  KL.setBrushSize(newSize) // since klecks doubles the size for some reason
                  KL.setBrushOpacity(newOpacity) // opacity ranges from 0-1, same size
                  KL.setBrushScatter(newScatter); // scatter ranges from 0-1, same size

                  prevSize = newSize;
                  prevOpacity = newOpacity;
                  prevScatter = newScatter;
                  
                // Copy the array, don't assign a reference!
                prevPixels = new Uint8ClampedArray(pixels);

                const inst = KL.instance;
                  const app = inst.klApp;

                  const path = []
                  const xStart = 200;
                  const yStart = 0;
                  let yCurrent = yStart
                  const yEnd = 1000;

                  for (let i=0; i < 11; i++) {
                    path.push({x: xStart, y: yCurrent})
                    yCurrent = yCurrent + 100
                  }

                  KL.clearLayer();
                  KL.draw(path);
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

            // Function to hide toolbar
            function hideToolbar() {
              const toolbar = document.querySelector('.kl-toolbar');
              if (toolbar) {
                toolbar.style.display = 'none';
                toolbar.style.visibility = 'hidden';
                toolbar.style.opacity = '0';
                toolbar.style.width = '0';
                toolbar.style.height = '0';
                toolbar.style.overflow = 'hidden';
              }
            }

            // MutationObserver to hide toolbar as soon as it appears
            const observer = new MutationObserver(() => {
              hideToolbar();
            });

            // Start observing the document body for changes
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });

            // Also try to hide it immediately and periodically
            hideToolbar();
            setInterval(hideToolbar, 100);

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
                hideToolbar();
              }, 100);

              // Keep hiding it after project opens
              setTimeout(hideToolbar, 500);
              setTimeout(hideToolbar, 1000);
              setTimeout(hideToolbar, 2000);

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
        /* Hide tool sidebar completely */
        .kl-toolbar {
            display: none !important;
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
