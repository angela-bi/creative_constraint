import React, { useEffect, useRef, useState } from "react";

type Ratio = [number, number];

type DrawingProps = {
  ratio: Ratio;
  setRatio?: React.Dispatch<React.SetStateAction<Ratio>>;
  colors?: { r: number; g: number; b: number };
  brushSize?: number; // Optional brush size prop
};

export default function DrawingSoftware({ 
  ratio, 
  setRatio, 
  colors,
  brushSize 
}: DrawingProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Extract brush size from ratio if not provided directly
  // ratio[0] is brush.width according to page.tsx
  const actualBrushSize = brushSize ?? ratio[0];

  // Send brush size to Klecks when it changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Only send if brushSize is a valid number
    if (typeof actualBrushSize !== 'number' || isNaN(actualBrushSize) || actualBrushSize <= 0) {
      return;
    }

    const sendBrushSize = () => {
      iframe.contentWindow?.postMessage(
        { type: "setBrushSize", size: actualBrushSize },
        "*"
      );
    };

    // Listen for ready message from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'klecksReady') {
        sendBrushSize();
      }
    };

    window.addEventListener('message', handleMessage);

    // Also try sending after a delay as fallback
    const timeout = setTimeout(() => {
      sendBrushSize();
    }, 2000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [actualBrushSize]);

  // Listening for ratio (your existing code)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendRatio = () => {
      iframe.contentWindow?.postMessage(
        { type: "updateRatio", payload: { ratio } },
        "*"
      );
    };

    const handleLoad = () => {
      sendRatio();
    };

    iframe.addEventListener("load", handleLoad);

    if (iframe.contentWindow) {
      sendRatio();
    }

    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [ratio]);

  // iframe with Klecks
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Get the origin from the parent window
    const origin = window.location.origin;

    // HTML content that loads Klecks
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <title>Klecks</title>
        <style>
          html, body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <script>
          // Load embed.js dynamically and wait for it to load
          (function() {
            let klecksInstance = null;
            
            const script = document.createElement('script');
            script.src = '${origin}/klecks/embed.js';
            script.onload = function() {
              // Initialize Klecks after script loads
              klecksInstance = new Klecks({
                onSubmit: async (onSuccess, onError) => {
                  onSuccess();
                },
              });

              // Create a default project
              klecksInstance.openProject({
                width: 1000,
                height: 1000,
                layers: [{
                  name: 'Background',
                  isVisible: true,
                  opacity: 1,
                  mixModeStr: 'source-over',
                  image: { fill: '#fff' },
                }]
              });

              // Notify parent that Klecks is ready
              if (window.parent) {
                window.parent.postMessage({ type: 'klecksReady' }, '*');
              }

              // Listen for messages from parent
              window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'updateRatio') {
                  // Handle ratio updates if needed
                }
                if (event.data && event.data.type === 'setBrushSize') {
                  // Handle brush size updates
                  const size = event.data.size;
                  if (klecksInstance && typeof size === 'number' && !isNaN(size) && size > 0) {
                    // Try different possible API methods for setting brush size
                    if (typeof klecksInstance.setBrushSize === 'function') {
                      klecksInstance.setBrushSize(size);
                    } else if (klecksInstance.brush && typeof klecksInstance.brush.setSize === 'function') {
                      klecksInstance.brush.setSize(size);
                    } else if (klecksInstance.setBrushWidth && typeof klecksInstance.setBrushWidth === 'function') {
                      klecksInstance.setBrushWidth(size);
                    } else if (klecksInstance.tool && klecksInstance.tool.brush && typeof klecksInstance.tool.brush.setSize === 'function') {
                      klecksInstance.tool.brush.setSize(size);
                    } else {
                      console.warn('Klecks API: Could not find method to set brush size. Available methods:', Object.keys(klecksInstance));
                    }
                  }
                }
              });
            };
            script.onerror = function() {
              console.error('Failed to load Klecks embed.js');
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

    return () => {
      URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <iframe
      sandbox="allow-scripts allow-same-origin"
      ref={iframeRef}
      style={{
        width: "100%",
        height: "100%",
        border: "1px solid gray",
        borderRadius: "12px",
        padding: "10px"
      }}
    />
  );
}

