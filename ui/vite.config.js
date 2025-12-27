import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: __dirname,
  base: "./",
  server: {
    port: 1420,
    strictPort: true,
    host: true,
  },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: ["es2021", "chrome105", "safari13"],
  },
});
