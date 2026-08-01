import { defineConfig } from "vite";
import { resolve } from "node:path";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = import.meta.dirname;

// Deployed at https://<user>.github.io/yayas_websites/app/ alongside the
// static marketing site at the repo root. Update if a custom domain drops
// the /yayas_websites path segment.
const BASE = "/yayas_websites/app/";

export default defineConfig({
  base: BASE,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        track: resolve(__dirname, "track.html"),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Walks with Yaya — Dashboard",
        short_name: "Yaya Walks",
        description: "Booking, walk tracking, and report cards for Walks with Yaya.",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        background_color: "#eef0ea",
        theme_color: "#2f6d5c",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
      },
    }),
  ],
});
