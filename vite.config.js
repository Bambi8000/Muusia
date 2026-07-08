import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Yhden tiedoston build: `npm run build` -> dist/index.html
// joka toimii tuplaklikattuna ilman serveriä (kaikki inlinettynä).
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    target: "esnext",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
