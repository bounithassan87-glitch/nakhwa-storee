import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./", // relative assets → can be hosted under /admin later
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    // Mirror production (admin served same-origin as the API): proxy /api to the
    // local Pages Functions dev server so the browser makes same-origin calls.
    proxy: {
      "/api": { target: "http://localhost:8788", changeOrigin: true },
    },
  },
});
