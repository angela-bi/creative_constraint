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
        <script src="${origin}/utils/bezier-spline.js"></script>
        <script src="${origin}/utils/color-spline-utils.js"></script>
        <script>
          (function() {
            let KL = null;
            let lastBrushSize = 50;
            let brushReady = false;
            const pendingMsgs = [];

            const { rgb2hsl, interpolate } = window.ColorSplineUtils;

            // central message handler
            function handleMessage(msg) {
              const inst = KL?.instance;
              const ui = inst.klApp.mobileUi;
              ui.toolspaceIsOpen = false;
              // ui.update();

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
                  window.pixels = msg.payload.pixels; // now just avg rgb
                  hsl = rgb2hsl(pixels['r'], pixels['g'], pixels['b'])
                  
                  let interp_size = interpolate('h', hsl)
                  console.log('hue and interpolated size', hsl['h'], interp_size)
                  KL.setBrushSize(interp_size/2) // since klecks doubles the size for some reason

                  let interp_opacity = interpolate('s', hsl)
                  console.log('saturation and interpolated opacity', hsl['s'], interp_opacity)
                  KL.setBrushOpacity(interp_opacity) // opacity ranges from 0-1

                  let interp_scatter = interpolate('l', hsl)
                  console.log('lightness and interpolated scatter', hsl['l'], interp_scatter)
                  KL.setBrushScatter(interp_scatter);

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
