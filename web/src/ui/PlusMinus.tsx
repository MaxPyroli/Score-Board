/** Signe + ou − dessiné en SVG : toujours parfaitement centré dans son bouton (un caractère de police ne l'est jamais). */
export function PlusMinus({ plus }: { plus: boolean }) {
  return (
    <svg className="plusminus" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path d={plus ? "M5 12h14M12 5v14" : "M5 12h14"} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Flèche de retour : trait épais aux bouts arrondis, centrée dans son bouton. */
export function BackArrow() {
  return (
    <svg className="backarrow" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path d="M20 12H5M11.5 5.5L5 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Partage : trois points reliés (le symbole habituel), trait épais comme les autres icônes. */
export function ShareIcon() {
  return (
    <svg className="glyph" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path d="M8.2 11l7.6-4M8.2 13l7.6 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="6" cy="12" r="3" fill="currentColor" />
      <circle cx="18" cy="6" r="3" fill="currentColor" />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
    </svg>
  );
}

/** Menu : trois points alignés, bien centrés. */
export function MoreIcon() {
  return (
    <svg className="glyph" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <circle cx="12" cy="5" r="2.4" fill="currentColor" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <circle cx="12" cy="19" r="2.4" fill="currentColor" />
    </svg>
  );
}

/** Petite couronne dorée posée au-dessus du joueur qui mène. */
export function Crown() {
  return (
    <svg className="crown" viewBox="0 0 24 18" width="22" height="16" aria-hidden="true" focusable="false">
      <path d="M3 15L1.8 5.2l5.3 4.1L12 2l4.9 7.3 5.3-4.1L21 15z" fill="#ffd45a" stroke="#2a2118" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3.4 15h17.2" stroke="#2a2118" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="2.6" r="1.5" fill="#ffd45a" stroke="#2a2118" strokeWidth="1.2" />
    </svg>
  );
}
