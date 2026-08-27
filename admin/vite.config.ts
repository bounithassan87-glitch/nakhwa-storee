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
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The repo-root shared/ modules, so presentation logic the server and the
      // dashboard must agree on lives in one place instead of two copies that
      // drift. Outside the Vite root, hence the explicit fs.allow below.
      "@shared": path.resolve(__dirname, "..", "shared"),
    },
  },
  server: {
    port: 5173,
    // shared/ sits above the Vite root; without this the dev server refuses to
    // serve it even though the alias resolves.
    fs: { allow: [path.resolve(__dirname), path.resolve(__dirname, "..", "shared")] },
    // Mirror production (admin served same-origin as the API): proxy /api to the
    // local Pages Functions dev server so the browser makes same-origin calls.
    proxy: {
      "/api": { target: "http://localhost:8788", changeOrigin: true },
    },
  },
}));
