import { useEffect } from "react";
import { CONTACT_EMAIL, COPYRIGHT, CREDIT, PRIVACY_DATE, PUBLISHER } from "../version";

/** Politique de confidentialité en plein écran (même habillage que les règles). */
export function PrivacySheet({ onClose }: { onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="final rules" role="dialog" aria-label="Confidentialité">
      <div className="final-inner">
        <header className="rules-head">
          <h2>Confidentialité</h2>
          <button className="icon" aria-label="Fermer la confidentialité" onClick={onClose}>✕</button>
        </header>
        <div className="card privacy-summary">
          <strong>En résumé</strong>
          <p>Sans pub, sans pistage. Pas de compte. Tes parties restent sur ton appareil, sauf quand tu choisis de les partager en direct.</p>
        </div>
        <details className="rules-section" open>
          <summary>Éditeur et contact</summary>
          <div className="rules-body">
            <p>Score Board est édité par {PUBLISHER}. Pour toute question : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          </div>
        </details>
        <details className="rules-section" open>
          <summary>Ce qui est enregistré, et où</summary>
          <div className="rules-body">
            <ul>
              <li>Tes parties (noms des joueurs, scores, réglages), tes derniers noms et tes préférences sont enregistrés <strong>uniquement dans ton navigateur</strong> (stockage local de l'appareil).</li>
              <li>Aucun compte n'est demandé. Aucune publicité, aucun outil de mesure d'audience, aucun traceur.</li>
              <li>Le site fonctionne hors connexion une fois chargé. Effacer les données du site dans ton navigateur supprime tout.</li>
              <li>Les polices et les scripts du site sont hébergés avec lui : aucune requête vers un tiers pour l'afficher.</li>
            </ul>
          </div>
        </details>
        <details className="rules-section" open>
          <summary>Partage en direct (service tiers : Firebase)</summary>
          <div className="rules-body">
            <p>Seulement si tu partages une partie ou si tu en rejoins une, le site contacte <strong>Firebase</strong> (Google), base de données hébergée en Europe (Belgique). Rien n'est envoyé avant.</p>
            <ul>
              <li>Pour partager : la partie (noms des joueurs, scores, réglages) est publiée sous un code de 4 caractères. Elle est supprimée quand tu arrêtes le partage ; si tu fermes l'appli sans l'arrêter, elle peut rester un temps sur le serveur.</li>
              <li>Chaque appareil reçoit un identifiant anonyme (connexion anonyme de Firebase, sans e-mail ni compte). Pendant une partie partagée, le serveur voit aussi quel joueur chaque appareil représente, son pseudo et, en cours de manche, le score qu'il a saisi.</li>
              <li>Comme tout service en ligne, Firebase reçoit l'adresse IP de l'appareil qui se connecte.</li>
              <li>Seuls ceux qui connaissent le code peuvent suivre la partie.</li>
            </ul>
          </div>
        </details>
        <details className="rules-section">
          <summary>Appareil photo</summary>
          <div className="rules-body">
            <p>Le bouton « Scanner le QR code » demande l'accès à l'appareil photo, uniquement pour lire le code d'une partie. L'image est analysée sur ton appareil : elle n'est ni enregistrée ni envoyée.</p>
          </div>
        </details>
        <p className="hint credits">{COPYRIGHT} · {CREDIT} · Dernière mise à jour : {PRIVACY_DATE}</p>
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
