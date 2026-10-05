import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
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
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  test: { environment: "node" },
});
