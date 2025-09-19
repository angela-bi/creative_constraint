import bpy
import asyncio
import threading
import sys
sys.path.append("/Users/angelabi/.local/lib/python3.11/site-packages")
import websockets
import json
import socket

_server_thread = None
_loop = None
_clients = set()  # store active WebSocket connections

# -------------------------
# WebSocket server
# -------------------------

async def echo(websocket):
    _clients.add(websocket)
    try:
        # Schedule the send on Blender's main thread
        bpy.app.timers.register(schedule_send_layers)

        async for message in websocket:
            print("Received from browser:", message)
            await websocket.send("Echo: " + message)
    except Exception as e:
        print("Client error:", e)
    finally:
        _clients.remove(websocket)
        

def find_free_port(start=8765, max_tries=20):
    """Find the first available port starting from `start`."""
    for port in range(start, start + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("localhost", port))
                return port
            except OSError:
                continue
    raise OSError(f"No free port found in range {start}-{start+max_tries-1}")

def start_server():
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    _port = find_free_port(8765, 20)

    async def run():
        async with websockets.serve(echo, "localhost", _port):
            print("✅ WebSocket server started at" + str(_port))
            await asyncio.Future()  # run forever

    _loop.run_until_complete(run())
    _loop.run_forever()

def register():
    global _server_thread
    if _server_thread and _server_thread.is_alive():
        print("⚠️ Server already running, skipping new thread.")
        return

    _server_thread = threading.Thread(target=start_server, daemon=True)
    _server_thread.start()
    print("✅ Server thread started")
    send_grease_pencil_layers()
    print('sent layers')


def unregister():
    global _loop, _server_thread
    if _loop:
        _loop.call_soon_threadsafe(_loop.stop)
        _loop = None
    if _server_thread:
        _server_thread.join(timeout=1)  # wait briefly for it to stop
        _server_thread = None
    print("🛑 Server stopped")


# -------------------------
# Broadcasting helpers
# -------------------------

def send_to_clients(message: str):
    """Send a raw string message to all connected clients"""
    global _loop
    if _loop and _clients:
        asyncio.run_coroutine_threadsafe(_broadcast(message), _loop)

async def _broadcast(message: str):
    for ws in list(_clients):
        try:
            await ws.send(message)
        except Exception as e:
            print(f"Failed to send to client: {e}")

# -------------------------
# Grease Pencil export
# -------------------------

def get_active_grease_pencil_layers():
    """Collect info about the active object's grease pencil layers"""
    obj = bpy.context.active_object
    if not obj or obj.type != 'GPENCIL':
        return {"error": "No active Grease Pencil object"}
    gp_data = obj.data
    layers_info = []
    for layer in gp_data.layers:
        layers_info.append({
            "name": layer.info,
            "frames": len(layer.frames),
            "active": layer == gp_data.layers.active,
            "visible": not layer.hide,
            "locked": layer.lock
        })
    return {
        "object_name": obj.name,
        "layers": layers_info
    }

def send_grease_pencil_layers():
    data = get_active_grease_pencil_layers()
    payload = {
        "type": "layers",
        "layers": [
            {
                "id": idx,
                "name": layer["name"],
                "visible": layer["visible"]
            }
            for idx, layer in enumerate(data["layers"])
        ]
    }
    send_to_clients(json.dumps(payload))
    print("📤 Sent grease pencil layers to clients")
    
def schedule_send_layers():
    # This runs safely on Blender's main thread
    send_grease_pencil_layers()
    return None  # don't repeat


if __name__ == "__main__":
    register()
