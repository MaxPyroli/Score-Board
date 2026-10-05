/** Petit pion (meeple) dessiné pour l'appli : repère « jeu de société » à côté du titre de l'accueil. */
export function Meeple() {
  return (
    <svg className="meeple" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d="M12 2.2c-2 0-3.4 1.4-3.4 3.2 0 .9.3 1.6.8 2.2C8 8.6 5.8 9.4 4 10.2c-1 .5-1.1 1.7-.3 2.4l2.6 2.2c.5.4 1 .4 1.5.1l.9-.6c-.2 1.8-.9 3.9-2.2 5.2-.7.7-.2 1.9.8 1.9h9.4c1 0 1.5-1.2.8-1.9-1.3-1.3-2-3.4-2.2-5.2l.9.6c.5.3 1 .3 1.5-.1l2.6-2.2c.8-.7.7-1.9-.3-2.4-1.8-.8-4-1.6-5.4-2.6.5-.6.8-1.3.8-2.2 0-1.8-1.4-3.2-3.4-3.2z"
        fill="currentColor"
      />
    </svg>
  );
}
