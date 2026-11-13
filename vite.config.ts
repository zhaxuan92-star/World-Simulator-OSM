import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/")) return "firebase";
          if (id.includes("node_modules/leaflet/") || id.includes("node_modules/react-leaflet/")) return "map";
          if (id.includes("world-atlas/countries-10m.json")) return "geodata-high";
          if (id.includes("node_modules/world-atlas/") || id.includes("node_modules/topojson-client/")) return "geodata";
          if (id.includes("node_modules/world-countries/")) return "country-data";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/")) return "react-vendor";
        }
      }
    }
  }
});
