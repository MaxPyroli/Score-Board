import { useEffect } from "react";
import { rulesFor, type RulesSection } from "../games/rules";

function Section({ section, open }: { section: RulesSection; open: boolean }) {
  return (
    <details className="rules-section" open={open}>
      <summary>{section.title}</summary>
      <div className="rules-body">
        {section.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
        {section.table && (
          <div className="rules-table-wrap">
            <table className="rules-table">
              <thead>
                <tr>{section.table.head.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {section.bullets && <ul>{section.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
      </div>
    </details>
  );
}

/**
 * Règles d'un jeu en plein écran : résumé, puis sections dépliables.
 * `focus` : section à ouvrir en premier (ex. « calcul » depuis la saisie, « mode-wins » depuis une partie).
 */
export function RulesSheet({ gameId, focus, onClose }: { gameId: string; focus?: string; onClose(): void }) {
  const doc = rulesFor(gameId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!doc) return null;
  const opened = doc.sections.some((s) => s.id === focus) ? focus : doc.sections[0]?.id;
  return (
    <div className="final rules" role="dialog" aria-label={`Règles : ${doc.title}`} data-game={gameId}>
      <div className="final-inner">
        <header className="rules-head">
          <h2>Règles · {doc.title}</h2>
          <button className="icon" aria-label="Fermer les règles" onClick={onClose}>✕</button>
        </header>
        <p className="rules-summary">{doc.summary}</p>
        {doc.sections.map((s) => <Section key={s.id} section={s} open={s.id === opened} />)}
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
