import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

type Ratio = [number, number];

type DrawingProps = {
  ratio: Ratio;
  soundLevel: number;
};

export type KlecksDrawingRef = {
  getBrushSize: () => Promise<number | null>;
  setBrushSize: (size: number) => void;
};

const KlecksDrawing = forwardRef<KlecksDrawingRef, DrawingProps>(({ ratio, soundLevel }, ref) => {
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
    iframe.contentWindow.postMessage({ type: "updateRatio", payload: { ratio } }, "*");
  }, [ratio]);

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
            let lastBrushSize = 4; // default

            const script = document.createElement('script');
            script.src = '${origin}/klecks/embed.js';
            script.onload = () => {
              KL = new Klecks({
                onSubmit: (success) => success(),
                onGetPenBrushSize: () => lastBrushSize
              });

              // Create default project
              KL.openProject({
                width: 1000,
                height: 1000,
                layers: [{ name: 'Background', isVisible: true, opacity: 1, mixModeStr: 'source-over', image: { fill: '#fff' } }]
              });

              window.parent.postMessage({ type: 'klecksReady' }, '*');
            };
            document.head.appendChild(script);

            let soundLevel = 0; // default
            window.addEventListener('message', (event) => {
              const msg = event.data;
              if (!msg || typeof msg !== 'object') return;

              if (msg.type === 'getBrushSize') {
                const size = KL?.getPenBrushSize ? KL.getPenBrushSize() : lastBrushSize;
                window.parent.postMessage({ type: 'brushSizeResponse', size, requestId: msg.requestId }, '*');
                console.log('size', size)
              }

              // if (msg.type === 'setBrushSize' && typeof msg.size === 'number') {
              //   lastBrushSize = msg.size;
              //   console.log('lastBrushSize', lastBrushSize)
              //   KL?.setPenBrushSize(msg.size);
              // }

              if (msg.type === 'updateSoundLevel') {
                // console.log('msg.payload.soundLevel', msg.payload.soundLevel)
                soundLevel = msg.payload.soundLevel;
              }

              if (msg.type === 'updateRatio') {
                const ratio = msg.payload.ratio[1]
                // soundLevel = msg.payload.soundLevel
                console.log('soundLevel', soundLevel)
                console.log('KL', KL.getBrushSize())
                const size = KL?.getBrushSize ? KL.getBrushSize() : lastBrushSize;
                //console.log('getpenbrushsize before changing', KL.getPenBrushSize())
                KL?.setBrushSize(ratio * soundLevel * 1000)
                //console.log('getpenbrushsize after changing', KL.getPenBrushSize())
              }
            });
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
