import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: "./", // relative assets → hosted under /admin in production
  define: {
    // Router basename: site root in dev (`serve`), /admin in the production
    // build (`build`). Committed here so it survives a clean checkout.
    __ADMIN_BASENAME__: JSON.stringify(command === "build" ? "/admin" : "/"),
  },
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
}));
