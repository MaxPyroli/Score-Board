import { useEffect, useState } from "react";

// « Mode assistant » : réglage de l'appareil, activé en bas de l'accueil. Il ajoute aux jeux compatibles (repérés par un tampon)
// des aides plus poussées (par exemple les menus et le choix par catégories de Sushi Go Party !).

const KEY = "scoreboard.assistant";
const EVENT = "scoreboard:assistant";

/**
 * Mode assistant : chantier mis de côté. Le code reste en place mais il est invisible partout (publique comme bêta) tant que
 * le site n'est pas construit avec `VITE_ASSISTANT=1`. Toute mention (réglage, tampon, texte, notes de version) passe par cet interrupteur.
 */
export const ASSISTANT_FEATURE: boolean = import.meta.env.VITE_ASSISTANT === "1";

export function assistantEnabled(): boolean {
  if (!ASSISTANT_FEATURE) return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAssistantEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch { /* sans importance */ }
  window.dispatchEvent(new Event(EVENT));
}

/** État du mode assistant, mis à jour dès qu'il change (autre écran, autre onglet). */
export function useAssistant(): boolean {
  const [on, setOn] = useState(assistantEnabled);
  useEffect(() => {
    const update = () => setOn(assistantEnabled());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  return on;
}
