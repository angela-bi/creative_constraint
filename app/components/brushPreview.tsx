import React, { useEffect, useRef, forwardRef, useImperativeHandle, SetStateAction } from "react";
import { Color, RGB } from "../page";

type DrawingProps = {
  pixels: RGB[];
  // soundLevel: number;
  //setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export type KlecksDrawingRef = {
  getBrushSize: () => Promise<number | null>;
  setBrushSize: (size: number) => void;
};

const BrushPreview = forwardRef<KlecksDrawingRef, DrawingProps>(({ pixels }, ref) => {
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
    //console.log('avg', avg)
    iframe.contentWindow.postMessage({ type: "updatePixels", payload: { pixels } }, "*");
  }, [pixels]);


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
        <script>
          (function() {
            let KL = null;
            let lastBrushSize = 50;
            let brushReady = false;
            const pendingMsgs = [];

            // Source - https://stackoverflow.com/a
            // Posted by Mic, modified by community. See post 'Timeline' for change history
            // Retrieved 2025-12-02, License - CC BY-SA 4.0

            function rgb2hsv (r, g, b) {
                let rabs, gabs, babs, rr, gg, bb, h, s, v, diff, diffc, percentRoundFn;
                rabs = r / 255;
                gabs = g / 255;
                babs = b / 255;
                v = Math.max(rabs, gabs, babs),
                diff = v - Math.min(rabs, gabs, babs);
                diffc = c => (v - c) / 6 / diff + 1 / 2;
                percentRoundFn = num => Math.round(num * 100) / 100;
                if (diff == 0) {
                    h = s = 0;
                } else {
                    s = diff / v;
                    rr = diffc(rabs);
                    gg = diffc(gabs);
                    bb = diffc(babs);

                    if (rabs === v) {
                        h = bb - gg;
                    } else if (gabs === v) {
                        h = (1 / 3) + rr - bb;
                    } else if (babs === v) {
                        h = (2 / 3) + gg - rr;
                    }
                    if (h < 0) {
                        h += 1;
                    }else if (h > 1) {
                        h -= 1;
                    }
                }
                return {
                    h: Math.round(h * 360),
                    s: percentRoundFn(s * 100),
                    v: percentRoundFn(v * 100)
                };
            }

            function mapRange(value, inMin, inMax, outMin, outMax) {
              const v = Math.min(Math.max(value, inMin), inMax);
              return outMin + ((v - inMin) * (outMax - outMin)) / (inMax - inMin);
            }

            function pixelToCanvas(pixels, param, alpha) {
              let total = 0;

              for (let i = 0; i < pixels.length; i++) {
                //let dist = (i - pixels.length / 2) * alpha;
                //console.log('dist', dist) dist is the problem here!!!
                let {h, s, v} = rgb2hsv(...pixels[i]);
                let value = param === 'h' ? h : param === 's' ? s : v;
                total += value
              }

              return total / pixels.length;
            }

            // central message handler
            function handleMessage(msg) {
              const inst = KL?.instance;
              const ui = inst.klApp.mobileUi;
              ui.toolspaceIsOpen = false;
              // ui.update();

              //console.log('KL', KL)
              //KL.draw([{x:50,y:50},{x:200,y:200}]);

              switch (msg.type) {

                case "setBrushSize":
                  if (brush) {
                    brush.size = msg.size;
                    lastBrushSize = msg.size;
                  }
                  break;

                case "getBrushSize":
                  window.parent.postMessage({
                    type: "brushSizeResponse",
                    requestId: msg.requestId,
                    size: brush ? brush.size : null
                  }, "*");
                  break;

                case "updatePixels":
                  window.pixels = msg.payload.pixels;
                  let rawSize = pixelToCanvas(pixels, 'h', 0.02);
                  let brush_size = mapRange(rawSize, -200, 200, 1, 200);
                  console.log('raw and brush size', rawSize, brush_size)
                  KL.setBrushSize(rawSize)

                  let rawOpacity = pixelToCanvas(pixels, 's', 0.0006);
                  let opacity = mapRange(rawOpacity, -50, 50, 0, 1);
                  console.log('raw and opacity', rawOpacity, opacity)
                  KL.setBrushOpacity(rawOpacity) // opacity ranges from 0-1

                  let rawScatter = pixelToCanvas(pixels, 'v', 0.0002);
                  let scatter = mapRange(rawScatter, -100, 100, 0, 100);
                  KL.setBrushScatter(100-rawScatter);
                  console.log('rawScatter and scatter', rawScatter, scatter)

                  KL.draw([{ x: 100, y: 100 }, { x: 500, y: 500 }]);

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
                onSubmit: (success) => success(),
                onGetPenBrushSize: () => lastBrushSize,
                onDraw: (path) => {
                  console.log("KL.draw called", path);

                  const inst = KL.instance;
                  const brush = inst.klApp.brushStroke;

                  brush.beginStroke(path[0].x, path[0].y);

                  for (let i = 1; i < path.length; i++) {
                    brush.continueStroke(path[i].x, path[i].y);
                  }

                  brush.endStroke();
                }
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
