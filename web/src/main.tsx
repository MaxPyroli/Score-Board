import "./channel"; // en premier : sépare le stockage de la bêta
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Clic rapide : on retient le clic un court instant pour que l'animation d'enfoncement soit toujours visible, puis on le rejoue.
const PRESSABLE = ".btn, .fab, .chip, .card.choice, .icon.round, .game, .card.round, .ticket-main, .ticket-trash";
const PRESS_MS = 140;
let replaying: Element | null = null;
if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
  document.addEventListener("click", (e) => {
    const el = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null;
    if (!el || el === replaying || (el as HTMLButtonElement).disabled) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (el.classList.contains("pressed")) return; // double clic pendant l'animation : ignoré
    el.classList.add("pressed");
    window.setTimeout(() => {
      el.classList.remove("pressed");
      replaying = el;
      el.click();
      replaying = null;
    }, PRESS_MS);
  }, true);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
