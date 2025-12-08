import React, { useEffect, useRef, forwardRef, useImperativeHandle, SetStateAction } from "react";
import { Color, RGB } from "../page";

type DrawingProps = {
  avg: RGB[];
  // soundLevel: number;
  setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export type KlecksDrawingRef = {
  getBrushSize: () => Promise<number | null>;
  setBrushSize: (size: number) => void;
};

const KlecksDrawing = forwardRef<KlecksDrawingRef, DrawingProps>(({ avg, setActiveColor }, ref) => {
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
    iframe.contentWindow.postMessage({ type: "updateAvg", payload: { avg } }, "*");
  }, [avg]);

  // useEffect(() => {
  //   const iframe = iframeRef.current;
  //   if (!iframe?.contentWindow) return;
  //   iframe.contentWindow.postMessage({ type: "updateSoundLevel", payload: { soundLevel } }, "*");
  // }, [soundLevel]);

  // useEffect(() => {
  //   function handle(ev: MessageEvent) {
  //     if (ev.data?.type === "activeColorChanged") {
  //       const rgb = ev.data.rgb; // [r, g, b]
  //       //console.log("Setting active color from iframe:", rgb);
  //       setActiveColor(rgb);
  //     }
  //   }
  
  //   window.addEventListener("message", handle);
  //   return () => window.removeEventListener("message", handle);
  // }, [setActiveColor]);

  // Inject Klecks into iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const origin = window.location.origin;
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Klecks</title>
        <style>
          /* Move tool sidebar to the right */
          .kl-toolbar {
            left: auto !important;
            right: 0 !important;
          }
          .kl-app {
            flex-direction: row-reverse !important;
          }
          /* adjust canvas margin so it doesn't overlap toolbar (tweak width as needed) */
          .kl-canvas-wrapper {
            margin-right: 260px !important;
            margin-left: 0 !important;
          }
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

            // continuous not discrete
            // opacity changing too easily
            // helper sum function, should generalize to other colors
            function sumAvgs(avgs, param, alpha) {
              let total = 0
              for (let i=0; i<10; i++) {
                let color = avgs[i]
                let hsv = rgb2hsv(color[0], color[1], color[2])
                let value = hsv[param]
                total += value*alpha
              }
              //console.log('sum avgs', total)
              return total
            }

            // central message handler
            function handleMessage(msg) {
              const inst = KL?.instance;
              if (!inst) return;

              const tool = inst.brushTool;
              const brush = tool?.brush;

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

                case "updateAvg":
                  window.avgs = msg.payload.avg;
                  let brush_size = sumAvgs(avgs, 'h', 0.02)
                  console.log('brush size', brush_size)
                  KL.setBrushSize(brush_size)
                  let opacity = sumAvgs(avgs, 's', 0.002)
                  console.log('opacity', opacity)
                  KL.setBrushOpacity(opacity) // opacity ranges from 0-1
                  // window.parent.postMessage({ type: "setOpacity", opacity: 0 }, "*");
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
                onGetPenBrushSize: () => lastBrushSize
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

              const waitReady = setInterval(() => {
                if (KL) {
                  brushReady = true;
                  clearInterval(waitReady);

                  setInterval(() => {
                    if (!KL) return;
                    const c = KL.getColor();
                    if (!c) return;

                    window.parent.postMessage(
                      { type: "activeColorChanged", rgb: [c.r, c.g, c.b] },
                      "*"
                    );
                  }, 200);

                  // flush queued messages
                  //console.log('pendingMsgs', pendingMsgs)
                  pendingMsgs.forEach(msg => handleMessage(msg));
                  pendingMsgs.length = 0;

                  window.parent.postMessage({ type: "klecksReady" }, "*");
                }
              }, 5);
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

KlecksDrawing.displayName = "KlecksDrawing";
export default KlecksDrawing;
