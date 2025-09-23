"use client";

import { useEffect, useCallback, useState } from "react";
import { ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
} from "@xyflow/react";
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: "1", position: { x: 100, y: 100 }, data: { label: "Node 1" } },
  { id: "2", position: { x: 300, y: 200 }, data: { label: "Node 2" } },
];

const initialEdges: Edge[] = [];

type Layer = { id: number; name: string; visible: boolean };

export default function HomePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  useEffect(() => {
    let wsInstance: WebSocket;

    const connect = async () => {
      try {
        const res = await fetch("http://localhost:8000");
        const { port } = await res.json();

        wsInstance = new WebSocket(`ws://localhost:${port}`);
        setWs(wsInstance);

        wsInstance.onopen = () => {
          setIsConnected(true);
          console.log("Connected to Blender server on port", port);
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
              console.log("Layers:", data.layers);
            } else if (data.type === "brush") {
              console.log("Brush:", data.brush);
            }
          } catch {
            console.log("Raw message:", event.data);
          }
        };
      } catch (err) {
        console.error("Failed to connect to Blender discovery server:", err);
      }
    };

    connect();

    return () => {
      if (wsInstance) wsInstance.close();
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
        <div>
          {/* <ul className="space-y-2">
            {layers.map((layer) => (
              <li
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`cursor-pointer p-2 border rounded ${
                  layer.visible ? "bg-green-200" : "bg-gray-200"
                }`}
              >
                {layer.name} [{layer.visible ? "ON" : "OFF"}]
              </li>
            ))}
          </ul> */}
          <div style={{ width: "100%", height: "100vh" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        </div>
      )}
    </main>
  );
}
