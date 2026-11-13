import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@react-three/fiber",
      "three",
      "three/examples/jsm/controls/OrbitControls.js",
      "three/examples/jsm/renderers/SVGRenderer.js",
      "three/examples/jsm/utils/BufferGeometryUtils.js",
    ],
  },
  server: { allowedHosts: ["terminal.local"] },
  build: { chunkSizeWarningLimit: 1100 },
});
