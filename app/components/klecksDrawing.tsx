import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { RGB } from "../page";

type DrawingProps = {
  avg: RGB[];
  soundLevel: number;
};

export type KlecksDrawingRef = {
  getBrushSize: () => Promise<number | null>;
  setBrushSize: (size: number) => void;
};

const KlecksDrawing = forwardRef<KlecksDrawingRef, DrawingProps>(({ avg, soundLevel }, ref) => {
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

  // Update ratio whenever it changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    // console.log('ratio', ratio)
    iframe.contentWindow.postMessage({ type: "updateAvg", payload: { avg } }, "*");
  }, [avg]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: "updateSoundLevel", payload: { soundLevel } }, "*");
  }, [soundLevel]);

  // Inject Klecks into iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const origin = window.location.origin;
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Klecks</title></head>
      <body style="margin:0; overflow:hidden;">
        <script>
          (function() {
            let KL = null;
            let lastBrushSize = 50;
            let brushReady = false;
            const pendingMsgs = [];

            // helper sum function, should generalize to other colors
            function sumAvgs(avgs, alpha) {
              let total = 0
              for (let i=0; i<10; i++) {
                total += avgs[i][0] * i * alpha
              }
              // console.log(total)
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

                case "updateSoundLevel":
                  window.soundLevel = msg.payload.soundLevel;
                  break;

                case "updateAvg":
                  window.avgs = msg.payload.avg;
                  console.log('avgs', avgs)
                  KL.setBrushSize(sumAvgs(avgs, 0.002))
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

                  // flush queued messages
                  console.log('pendingMsgs', pendingMsgs)
                  pendingMsgs.forEach(msg => handleMessage(msg));
                  pendingMsgs.length = 0;

                  window.parent.postMessage({ type: "klecksReady" }, "*");
                }
              }, 50);
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

KlecksDrawing.displayName = "KlecksDrawing";
export default KlecksDrawing;
