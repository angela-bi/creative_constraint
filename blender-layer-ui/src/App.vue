<template>
  <div class="app">
    <h1>Blender Layers</h1>

    <div v-if="layers.length === 0">Waiting for Blender...</div>

    <ul>
      <li
        v-for="layer in layers"
        :key="layer.id"
        @click="toggleLayer(layer.id)"
        :class="{ visible: layer.visible }"
      >
        {{ layer.name }} [{{ layer.visible ? "ON" : "OFF" }}]
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const layers = ref([]);
let ws;

onMounted(() => {
  ws = new WebSocket("ws://localhost:8765");

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "update") {
      layers.value = data.layers;
    }
  };
});

function toggleLayer(id) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "toggle_layer", id }));
  }
}
</script>

<style scoped>
.app {
  font-family: sans-serif;
  padding: 20px;
}

ul {
  list-style: none;
  padding: 0;
}

li {
  cursor: pointer;
  padding: 6px;
  border: 1px solid #ccc;
  margin-bottom: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

li:hover {
  background: #f0f0f0;
}

li.visible {
  font-weight: bold;
  color: green;
}
</style>
