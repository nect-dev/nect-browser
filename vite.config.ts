import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  root: "src",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../build/src",
    copyPublicDir: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "src/main.html",
        sidebar: "src/sidebar.html",
      },
    },
  },
  resolve: {
    alias: {
      "@/": `${__dirname}/src/`,
    },
  },
});
