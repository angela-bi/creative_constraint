import React, { useEffect, useRef, forwardRef, useImperativeHandle, SetStateAction } from "react";
import { Color, RGB } from "../page";

type DrawingProps = {
  pixels: RGB[];
  // soundLevel: number;
  setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export type KlecksDrawingRef = {
  getBrushSize: () => Promise<number | null>;
  setBrushSize: (size: number) => void;
};

const KlecksDrawing = forwardRef<KlecksDrawingRef, DrawingProps>(({ pixels, setActiveColor }, ref) => {
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

            function rgb2hsl(r, g, b) {
              // https://gist.github.com/mjackson/5311256
              r /= 255, g /= 255, b /= 255;

              var max = Math.max(r, g, b), min = Math.min(r, g, b);
              var h, s, l = (max + min) / 2;

              if (max == min) {
                h = s = 0; // achromatic
              } else {
                var d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                switch (max) {
                  case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                  case g: h = (b - r) / d + 2; break;
                  case b: h = (r - g) / d + 4; break;
                }

                h /= 6;
              }

              return {'h': h, 's': s, 'l': l };
            }

            function mapRange(value, inMin, inMax, outMin, outMax) {
              const v = Math.min(Math.max(value, inMin), inMax);
              return outMin + ((v - inMin) * (outMax - outMin)) / (inMax - inMin);
            }

            function pixelToCanvas(pixels, param, alpha) {
              let total = 0;

              for (let i = 0; i < pixels.length; i++) {
                //let dist = i - (pixels.length / 2) * alpha;
                //console.log('dist', dist)
                let {h, s, l} = rgb2hsl(...pixels[i]);
                let value = param === 'h' ? h : param === 's' ? s : l;
                total += value
              }

              return total / pixels.length;
            }

            // central message handler
            function handleMessage(msg) {
              const inst = KL?.instance;
              const ui = inst.klApp.mobileUi;
              // ui.toolspaceIsOpen = true;
              // ui.update();
              //console.log('inst klecksdrawing, should be true', ui.toolspaceIsOpen)

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

                case "updatePixels":
                  window.pixels = msg.payload.pixels;
                  let rawSize = pixelToCanvas(pixels, 'h', 1);
                  let brush_size = mapRange(rawSize, -200, 200, 1, 200);
                  console.log('raw and brush size', rawSize, brush_size)
                  KL.setBrushSize(rawSize)

                  let rawOpacity = pixelToCanvas(pixels, 's', 0.0002);
                  let opacity = mapRange(rawOpacity, -50, 50, 0, 1);
                  console.log('raw and opacity', rawOpacity, opacity)
                  KL.setBrushOpacity(rawOpacity) // opacity ranges from 0-1

                  let rawScatter = pixelToCanvas(pixels, 'l', 0.0002);
                  let scatter = mapRange(rawScatter, -100, 100, 0, 100);
                  KL.setBrushScatter(100-scatter);
                  console.log('rawScatter and scatter', rawScatter, scatter)

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
