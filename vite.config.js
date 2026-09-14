import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the same build works from a file server, Capacitor's
  // capacitor://localhost origin, and any static host.
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2020" },
  server: { host: true, port: 5173 },
});
