import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_URL = process.env.VITE_API_URL || "";

const proxy: Record<string, unknown> = {};
if (API_URL) {
  proxy["/api"] = {
    target: API_URL,
    changeOrigin: true,
    secure: false,
    configure(proxyInstance) {
      proxyInstance.on("error", (err: Error, req, res) => {
        if ((err as any).code === "ECONNREFUSED" || (err as any).code === "ECONNRESET") {
          if (typeof res?.writeHead === "function") {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, message: "Backend unavailable" }));
          }
          return;
        }
        console.error("Proxy error:", err.message);
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["lucide-react"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-qr": ["html5-qrcode", "jsqr", "qrcode"],
          "vendor-html2canvas": ["html2canvas"],
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
        compact: true,
      },
    },
    chunkSizeWarningLimit: 500,
    cssMinify: "esbuild",
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    reportCompressedSize: true,
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "lucide-react", "html5-qrcode"],
    exclude: ["@vitejs/plugin-react"],
  },
  esbuild: {
    treeShaking: true,
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
});
