import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 5111
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["1.jpg", "favicon.svg"],
      devOptions: {
        enabled: true
      },
      manifest: {
        name: "Soly",
        short_name: "Soly",
        description: "Soly — Gestión inteligente, simplificada. CRM para negocios de servicios.",
        theme_color: "#006666",
        background_color: "#e7e5e4",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/1.jpg",
            sizes: "192x192",
            type: "image/jpeg"
          },
          {
            src: "/1.jpg",
            sizes: "512x512",
            type: "image/jpeg"
          },
          {
            src: "/1.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "maskable"
          }
        ]
      }
    })
  ]
});
