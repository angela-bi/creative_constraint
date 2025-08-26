"use client";

import { useEffect, useState } from "react";

type Layer = { id: number; name: string; visible: boolean };

// ref: https://www.pedroalonso.net/blog/websockets-nextjs-part-1/

export default function HomePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);

  useEffect(() => {
    const wsInstance = new WebSocket("ws://localhost:8765");

    setWs(wsInstance);

    wsInstance.onopen = () => {
      setIsConnected(true);
      console.log("Connected to Blender server");
    };

    wsInstance.onclose = () => {
      setIsConnected(false);
      console.log("Disconnected from Blender server");
    };

    wsInstance.onmessage = (event) => {
      console.log("Message from Blender:", event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === "layers") {
          setLayers(data.layers);
        }
      } catch {
        console.log("Raw message:", event.data);
      }
    };

    return () => {
      wsInstance.close();
    };
  }, []);

  const toggleLayer = (id: number) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "toggle_layer", id }));
    }
  };

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Blender Layers</h1>
      {!isConnected ? (
        <p>Waiting for Blender…</p>
      ) : (
        <ul className="space-y-2">
          {layers.map((layer) => (
            <li
              key={layer.id}
              // onClick={() => toggleLayer(layer.id)}
              className={`cursor-pointer p-2 border rounded ${
                layer.visible ? "bg-green-200" : "bg-gray-200"
              }`}
            >
              {layer.name} [{layer.visible ? "ON" : "OFF"}]
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
