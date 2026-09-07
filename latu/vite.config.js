import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    target: "esnext",
    outDir: "../public/latu",
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
