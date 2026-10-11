/**
 * Symboles des sept familles de cartes de 7 Wonders (ceux de la feuille de score, utiles aussi aux daltoniens), redessinés pour l'appli :
 * merveille = pentagone jaune, pièces = rond jaune, militaire = carré et octogone rouges, civils (bleu) = barre,
 * commerce (jaune) = rond, sciences (vert) = triangle, guildes (violet) = étoile.
 */
export type WonderSymbol = "wonder" | "coins" | "military" | "civil" | "commerce" | "science" | "guilds";

const INK = "#2a2118";
const GOLD = "#f6b93b";

export function WonderBadge({ kind }: { kind: WonderSymbol }) {
  return (
    <svg className="wbadge" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" focusable="false">
      {kind === "wonder" && (<><rect width="44" height="44" rx="9" fill="#fffaf0" /><polygon points="22,7 37,18 31,37 13,37 7,18" fill={GOLD} stroke={INK} strokeWidth="2" strokeLinejoin="round" /></>)}
      {kind === "coins" && (<><rect width="44" height="44" rx="9" fill="#fffaf0" /><circle cx="22" cy="22" r="12" fill={GOLD} stroke={INK} strokeWidth="2" /></>)}
      {kind === "military" && (<><rect width="44" height="44" rx="9" fill="#fffaf0" /><rect x="5" y="12" width="15" height="20" rx="4" fill="#e03a3a" stroke={INK} strokeWidth="2" /><polygon points="29,10 36,10 41,15 41,22 36,27 29,27 24,22 24,15" transform="translate(-2 4)" fill="#e03a3a" stroke={INK} strokeWidth="2" strokeLinejoin="round" /></>)}
      {kind === "civil" && (<><rect width="44" height="44" rx="9" fill="#3b82d6" /><rect x="18" y="9" width="8" height="26" rx="3" fill="#fff" stroke={INK} strokeWidth="2" /></>)}
      {kind === "commerce" && (<><rect width="44" height="44" rx="9" fill="#f5a623" /><circle cx="22" cy="22" r="10" fill="#fff" stroke={INK} strokeWidth="2" /></>)}
      {kind === "science" && (<><rect width="44" height="44" rx="9" fill="#3a9d4a" /><polygon points="22,9 36,34 8,34" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" /></>)}
      {kind === "guilds" && (<><rect width="44" height="44" rx="9" fill="#6b4bb0" /><polygon points="22,8 26.5,17.5 37,19 29.5,26.5 31.5,37 22,32 12.5,37 14.5,26.5 7,19 17.5,17.5" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" /></>)}
    </svg>
  );
}
