import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "Foody",
        short_name: "Foody",
        description: "Order delicious food with Foody",
        theme_color: "#ff4d4d",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/foody-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/foody-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});