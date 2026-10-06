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
