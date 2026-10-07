import type { CSSProperties, ReactNode } from "react";
import { BackArrow, PlusMinus } from "./PlusMinus";
import { plain, signed, type Player } from "../core";

/** Nombre de colonnes : une seule ligne jusqu'à 6 joueurs, puis des lignes équilibrées de 5 joueurs au plus (7 → 4+3, 12 → 3 × 4). */
export function gridColumns(n: number): number {
  if (n <= 6) return Math.max(1, n);
  const rows = Math.ceil(n / 5);
  return Math.ceil(n / rows);
}

export function PlayerGrid({ players, children, className = "" }: { players: Player[]; children: (p: Player) => ReactNode; className?: string }) {
  const style: CSSProperties = { gridTemplateColumns: `repeat(${gridColumns(players.length)}, minmax(0, 1fr))` };
  return (
    <div className={`grid ${className}`} style={style}>
      {players.map((p) => (
        <div key={p.id} className="cell">{children(p)}</div>
      ))}
    </div>
  );
}

export function Score({ value, withSign, big, leader }: { value: number; withSign?: boolean; big?: boolean; leader?: boolean }) {
  const text = withSign ? signed(value) : plain(value);
  // Très grands nombres (compteurs libres) : on réduit la taille plutôt que de déborder.
  const size = text.length > 9 ? "vlong" : text.length > 6 ? "long" : "";
  const cls = ["score", big ? "big" : "", leader ? "leader" : "", size, withSign ? (value > 0 ? "pos" : value < 0 ? "neg" : "") : ""];
  return <span className={cls.join(" ")}>{text}</span>;
}

export function Chip({ label, selected, onClick, disabled }: { label: string; selected: boolean; onClick(): void; disabled?: boolean }) {
  return (
    <button type="button" className={`chip ${selected ? "on" : ""}`} aria-pressed={selected} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

export const Chips = ({ children }: { children: ReactNode }) => <div className="chips">{children}</div>;
export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="section">
    <h3>{title}</h3>
    {children}
  </section>
);

export function TopBar({ title, onBack, actions }: { title: ReactNode; onBack?: () => void; actions?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? <button className="icon round back" aria-label="Retour" onClick={onBack}><BackArrow /></button> : <span className="icon-gap" />}
      <h1>{typeof title === "string" ? <span className="title-text">{title}</span> : title}</h1>
      <div className="actions">{actions}</div>
    </header>
  );
}

/** Bouton « Règles » : sur écran étroit il devient un simple « ? » pour laisser de la place au titre. */
export function RulesButton({ onClick }: { onClick(): void }) {
  return (
    <button className="btn outline small rules-btn" aria-label="Règles" onClick={onClick}>
      <span className="rules-label">Règles</span><span className="rules-q" aria-hidden="true">?</span>
    </button>
  );
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange(v: number): void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="icon round" aria-label="Moins" disabled={value <= min} onClick={() => onChange(value - 1)}><PlusMinus plus={false} /></button>
      <span className="value">{value}</span>
      <button type="button" className="icon round" aria-label="Plus" disabled={value >= max} onClick={() => onChange(value + 1)}><PlusMinus plus /></button>
    </div>
  );
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
