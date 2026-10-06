import { useEffect } from "react";
import changelog from "../../../CHANGELOG.md?raw";
import { IS_BETA } from "../channel";

type Entry = { title: string; items: string[] };

/** Lit CHANGELOG.md : « ## titre » ouvre une version, « - texte » ajoute une ligne. */
function parse(raw: string): Entry[] {
  const entries: Entry[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("## ")) entries.push({ title: line.slice(3).trim(), items: [] });
    else if (line.startsWith("- ") && entries.length) {
      const text = line.slice(2).trim();
      // Le mode assistant n'est visible qu'en bêta : la version publique n'en parle pas.
      if (IS_BETA || !/assistant/i.test(text)) entries[entries.length - 1].items.push(text);
    }
  }
  return entries;
}

const entries = parse(changelog);

/** Notes de version en plein écran (même habillage que les règles). */
export function ChangelogSheet({ onClose }: { onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="final rules" role="dialog" aria-label="Notes de version">
      <div className="final-inner">
        <header className="rules-head">
          <h2>Notes de version</h2>
          <button className="icon" aria-label="Fermer les notes de version" onClick={onClose}>✕</button>
        </header>
        {entries.map((e, i) => (
          <details key={e.title} className="rules-section" open={i === 0}>
            <summary>{e.title}</summary>
            <div className="rules-body"><ul>{e.items.map((t, j) => <li key={j}>{t}</li>)}</ul></div>
          </details>
        ))}
        <p className="hint credits">
          Crédits : icône « Meeple » de Delapouite sur{" "}
          <a href="https://game-icons.net/1x1/delapouite/meeple.html" target="_blank" rel="noreferrer">game-icons.net</a>
          , licence <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>.
        </p>
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
