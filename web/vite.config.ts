import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" : le site fonctionne depuis n'importe quel sous-dossier (GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { environment: "node" },
});
