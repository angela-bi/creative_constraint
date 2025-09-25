"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  MarkerType,
  useNodesState,
  Connection,
  Edge,
} from "@xyflow/react";
import '@xyflow/react/dist/style.css';
import { SoundLevelNode } from "./soundLevelNode";
import { BrushSettingNode } from "./brushSettingNode";

const nodeTypes = { soundNode: SoundLevelNode, brushNode: BrushSettingNode };

const initialEdges: Edge[] = [];

// type Layer = { id: number; name: string; visible: boolean };

export default function HomePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // const [layers, setLayers] = useState<Layer[]>([]);

  const initialNodes = [
    {
      id: "mic1",
      type: "soundNode",
      position: { x: 100, y: 100 },
      data: {level: undefined},
    },
    {
      id: "brush1",
      type: "brushNode",
      position: { x: 300, y: 200 },
      data: {},
    }
  ];
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const hasSoundToBrushLink = edges.some(
    (e) =>
      nodes.find((n) => n.id === e.source)?.type === "soundNode" &&
      nodes.find((n) => n.id === e.target)?.type === "brushNode"
  );

  const onConnect = useCallback((connection: Connection) => {
    let sound_level = nodes.find((n) => n.id === connection.source)
    console.log('sound level', sound_level)
    // setMicLevels(nodes.find((n) => n.id === "s")?)
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          markerEnd: { type: MarkerType.ArrowClosed, color: "gray" },
          style: { strokeWidth: 1, stroke: "gray" },
        },
        eds
      )
    )
  }
  , []);

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

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === "mic1"
          ? { ...n, data: { ...n.data, ws, connectedToBrush: hasSoundToBrushLink } }
          : n
      )
    );
  }, [ws, hasSoundToBrushLink, setNodes]);

  // useEffect(() => {
  //   if (!ws || ws.readyState !== WebSocket.OPEN) return;
  //   if (!hasSoundToBrushLink) return;
  //   //console.log('sound and brush connected')
  
  //   const interval = setInterval(() => {
  //     nodesRef.current.forEach((n) => {
  //       if (n.type === "soundNode" && n.data.level !== undefined) {
  //         ws.send(
  //           JSON.stringify({
  //             type: "sound_level",
  //             node: n.id,
  //             level: n.data.level,
  //           })
  //         );
  //       }
  //     });
  //   }, 100);
  
  //   return () => clearInterval(interval);
  // }, [ws, nodes, hasSoundToBrushLink]);

  // const toggleLayer = (id: number) => {
  //   if (ws && ws.readyState === WebSocket.OPEN) {
  //     ws.send(JSON.stringify({ type: "toggle_layer", id }));
  //   }
  // };

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Blender Mappings</h1>
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
            nodeTypes={nodeTypes}
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
