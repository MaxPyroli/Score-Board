import { catalogGame } from "../games/catalog";
// Illustrations maison des jeux : trois cartes en éventail avec un symbole propre à chaque jeu.
// Volontairement stylisées et sans logo officiel ; en SVG, donc légères et disponibles hors ligne.
const CARDS: Record<string, [string, string, string]> = {
  tarot: ["♠", "★", "♥"],
  skyjo: ["−2", "12", "0"],
  sixquiprend: ["104", "55", "6"],
  rail: ["4", "+10", "21"],
  sushi: ["3", "+6", "−6"],
  free: ["+5", "−1", "0"],
};

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

export function GameArt({ gameId, className = "" }: { gameId: string; className?: string }) {
  const entry = catalogGame(gameId);
  const labels = CARDS[gameId] ?? (entry ? [initial(entry.name), entry.emoji, "★"] : CARDS.free);
  const cards = [
    { r: -18, x: 14, y: 22, label: labels[0] },
    { r: 0, x: 46, y: 10, label: labels[1] },
    { r: 18, x: 82, y: 22, label: labels[2] },
  ];
  return (
    <svg className={`game-art ${className}`} viewBox="0 0 140 110" aria-hidden="true" focusable="false">
      {cards.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.r} 22 32)`}>
          <rect width="44" height="64" rx="7" fill="#fff" />
          <rect x="3" y="3" width="38" height="58" rx="5" fill="none" stroke="currentColor" strokeOpacity=".35" />
          <text x="22" y="40" textAnchor="middle" fontSize={c.label.length > 2 ? 17 : 24} fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
