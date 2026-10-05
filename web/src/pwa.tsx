import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Active le mode hors ligne et surveille les nouvelles versions du site (au démarrage, toutes les 30 minutes,
 * et à chaque retour sur l'appli). `onNeedRefresh` est appelé quand une nouvelle version est prête ;
 * la fonction renvoyée l'applique (rechargement de la page).
 */
export function registerUpdates(onNeedRefresh: () => void): () => void {
  const update = registerSW({
    onNeedRefresh,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => { void registration.update().catch(() => {}); };
      window.setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    },
  });
  return () => { void update(true); };
}

/**
 * État des mises à jour pour l'interface. Une nouvelle version est appliquée toute seule quand il n'y a rien
 * à perdre (accueil, ou juste après le démarrage) ; sinon `ready` devient vrai et un bandeau la propose.
 */
export function useAppUpdate() {
  const startedAt = useRef(Date.now());
  const apply = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [idle, setIdle] = useState(false);

  useEffect(() => { apply.current = registerUpdates(() => setReady(true)); }, []);

  const doApply = useCallback(() => { setApplying(true); apply.current(); }, []);
  useEffect(() => {
    if (ready && !applying && (idle || Date.now() - startedAt.current < 15000)) doApply();
  }, [ready, idle, applying, doApply]);

  return { ready, applying, apply: doApply, setIdle: useCallback((v: boolean) => setIdle(v), []) };
}

export function UpdateBanner({ onApply }: { onApply(): void }) {
  return createElement(
    "div",
    { className: "toast update", role: "status" },
    "Nouvelle version disponible",
    createElement("button", { onClick: onApply }, "Mettre à jour"),
  );
}
