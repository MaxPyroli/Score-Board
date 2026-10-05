import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

// Identifiant de construction : commit + date, pour voir d'un coup d'œil si le site est à jour.
function commit(): string {
  const fromCi = process.env.GITHUB_SHA?.slice(0, 7);
  if (fromCi) return fromCi;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

// base "./" : le site fonctionne depuis n'importe quel sous-dossier (GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    // Site installable et utilisable sans internet. `prompt` : la nouvelle version est préparée en arrière-plan,
    // puis appliquée par l'appli (voir src/pwa.ts) au bon moment.
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Score Board",
        short_name: "Score Board",
        description: "Compteur de points pour jeux de société",
        lang: "fr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f6f5f1",
        theme_color: "#1f6f5c",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,webp,webmanifest}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
    }),
  ],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  test: { environment: "node" },
});
