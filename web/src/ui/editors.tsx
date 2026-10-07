import { useMemo, useState } from "react";
import { Chip, Chips, PlayerGrid, RulesButton, Score, Section, Stepper, TopBar } from "./components";
import { PlusMinus } from "./PlusMinus";
import { RulesSheet } from "./RulesSheet";
import { plain, type GameModule, type StoredMatch } from "../core";
import type { EditorProps } from "../games/registry";
import {
  atoutsRequis, buildRound, calculer, CHELEM_CHOICES, CONTRACTS, draftFromRound, draftStep, initialDraft, POIGNEES,
  pointsDefense, pointsVerrouilles, seuilRequis, tarotModule, TOTAL_POINTS, withChelem, withPoints, withPointsDelta,
  type TarotDraft,
} from "../games/tarot";
import { buildSkyjo, calculerSkyjo, emptySkyjoDraft, skyjoDraftFrom, skyjoModule, type SkyjoDraft } from "../games/skyjo";
import {
  MAX_STATIONS, ROUTE_POINTS, buildRail, draftFromSheet, emptyDraftSheet, railConfig, railModule, routesPoints, sheetTotal,
  type RailDraftSheet,
} from "../games/rail";
import { buildSushi, draftFromSheet as sushiDraftFrom, fieldsFor, ROUNDS_BEFORE_DESSERT, scoreSushi, sushiConfig, sushiModule, type SushiDraftSheet } from "../games/sushi";
import { buildFree, changesOf, emptyFreeDraft, freeDraftFrom, negateRound, winnerRound, type FreeDraft, type FreeRound } from "../games/counter";

const title = (match: StoredMatch, index: number | null) =>
  match.moduleId === "rail"
    ? (index !== null ? "Modifier le décompte final" : "Décompte final")
    : match.moduleId === "sushi" && match.settings.assistant === "true"
    ? (() => {
        const at = index ?? match.rounds.length;
        return at >= ROUNDS_BEFORE_DESSERT ? (index !== null ? "Modifier les desserts" : "Desserts") : index !== null ? `Modifier la manche ${at + 1}` : `Manche ${at + 1}`;
      })()
    : index !== null ? `Modifier la manche ${index + 1}` : `Manche ${match.rounds.length + 1}`;

function Frame(props: EditorProps & { children: React.ReactNode; footer: React.ReactNode; canSave: boolean; onValidate(): void; rulesFocus?: string }) {
  const { match, roundIndex, onCancel, onDelete, children, footer, canSave, onValidate, rulesFocus } = props;
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <div className="screen" data-game={match.moduleId}>
      <TopBar
        title={title(match, roundIndex)}
        onBack={onCancel}
        actions={<RulesButton onClick={() => setRulesOpen(true)} />}
      />
      {rulesOpen && <RulesSheet gameId={match.moduleId} focus={rulesFocus} onClose={() => setRulesOpen(false)} />}
      <main className="content">
        {children}
        {onDelete && <button className="link danger" onClick={onDelete}>Supprimer cette manche</button>}
        <div className="spacer" />
      </main>
      <footer className="bottom">
        {footer}
        <div className="buttons">
          <button className="btn outline" onClick={onCancel}>Annuler</button>
          <button className="btn" disabled={!canSave} onClick={onValidate}>Valider</button>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- Tarot

export function TarotEditor(props: EditorProps) {
  const { match, roundIndex, onSave } = props;
  const demiPoints = match.settings[tarotModule.SETTING_DEMI_POINTS] === "true";
  const [draft, setDraft] = useState<TarotDraft>(() => {
    const existing = roundIndex !== null ? match.rounds[roundIndex] : undefined;
    return existing !== undefined
      ? draftFromRound(tarotModule.decodeRound(existing), demiPoints)
      : initialDraft(match.players.map((p) => p.id), demiPoints);
  });
  const set = (patch: Partial<TarotDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const built = useMemo(() => buildRound(draft), [draft]);
  const result = built.round ? calculer(built.round) : null;
  const locked = pointsVerrouilles(draft);
  const step = draftStep(draft);
  const n = match.players.length;

  return (
    <Frame
      {...props}
      canSave={!!built.round}
      rulesFocus="calcul"
      onValidate={() => built.round && onSave(tarotModule.encodeRound(built.round))}
      footer={
        result ? (
          <>
            <div className={`verdict ${result.contratReussi ? "ok" : "ko"}`}>{result.contratReussi ? "Contrat réussi" : "Contrat chuté"}</div>
            <PlayerGrid players={match.players}>
              {(p) => (
                <>
                  <span className="name">{p.name}</span>
                  <Score value={result.points[p.id] ?? 0} withSign />
                </>
              )}
            </PlayerGrid>
          </>
        ) : (
          <div className="error">{built.error}</div>
        )
      }
    >
      <Section title="Preneur">
        <Chips>
          {match.players.map((p) => (
            <Chip key={p.id} label={p.name} selected={draft.preneurId === p.id} onClick={() => set({ preneurId: p.id })} />
          ))}
        </Chips>
      </Section>

      {n === 5 && (
        <Section title="Appelé">
          <p className="hint">« Seul » : le preneur a le roi appelé dans sa main ou au chien.</p>
          <Chips>
            {match.players.map((p) => (
              <Chip
                key={p.id}
                label={p.id === draft.preneurId ? `${p.name} (seul)` : p.name}
                selected={draft.appeleId === p.id}
                onClick={() => set({ appeleId: p.id })}
              />
            ))}
          </Chips>
        </Section>
      )}

      <Section title="Contrat">
        <Chips>
          {CONTRACTS.map((c) => (
            <Chip key={c.id} label={`${c.label} ×${c.multiplier}`} selected={draft.contract === c.id} onClick={() => set({ contract: c.id })} />
          ))}
        </Chips>
      </Section>

      <Section title="Bouts de l'attaque">
        <Chips>
          {[0, 1, 2, 3].map((b) => (
            <Chip key={b} label={String(b)} selected={draft.bouts === b} onClick={() => set({ bouts: b })} />
          ))}
        </Chips>
        <p className="hint">Points à atteindre : {seuilRequis(draft.bouts)}</p>
      </Section>

      <Section title="Points réalisés">
        <div className="split">
          <div>
            <div className="label">Attaque</div>
            <div className="bignum primary">{plain(draft.pointsRealises)}</div>
          </div>
          <div className="right">
            <div className="label">Défense</div>
            <div className="bignum">{plain(pointsDefense(draft))}</div>
          </div>
        </div>
        <input
          type="range" className="slider" min={0} max={TOTAL_POINTS} step={step} value={draft.pointsRealises}
          disabled={locked} aria-label="Points réalisés par l'attaque"
          onChange={(e) => setDraft((d) => withPoints(d, Number(e.target.value)))}
        />
        <div className="split">
          <button className="btn outline small" disabled={locked} onClick={() => setDraft((d) => withPointsDelta(d, -1))}>− {plain(step)}</button>
          <button className="btn outline small" disabled={locked} onClick={() => setDraft((d) => withPointsDelta(d, 1))}>+ {plain(step)}</button>
        </div>
        {locked && <p className="hint">Chelem réussi : l'attaque a fait tous les points.</p>}
      </Section>

      <Section title="Poignée">
        <Chips>
          <Chip label="Aucune" selected={draft.poignee === null} onClick={() => set({ poignee: null })} />
          {POIGNEES.map((p) => (
            <Chip
              key={p.id}
              label={`${p.label[0].toUpperCase()}${p.label.slice(1)} · ${atoutsRequis(p.id, n)} atouts (+${p.bonus})`}
              selected={draft.poignee === p.id}
              onClick={() => set({ poignee: p.id })}
            />
          ))}
        </Chips>
        {draft.poignee && (
          <Chips>
            <Chip label="Attaque" selected={draft.poigneeCamp === "ATTAQUE"} onClick={() => set({ poigneeCamp: "ATTAQUE" })} />
            <Chip label="Défense" selected={draft.poigneeCamp === "DEFENSE"} onClick={() => set({ poigneeCamp: "DEFENSE" })} />
          </Chips>
        )}
      </Section>

      <Section title="Petit au bout">
        <Chips>
          <Chip label="Aucun" selected={draft.petitAuBoutCamp === null} onClick={() => set({ petitAuBoutCamp: null })} />
          <Chip label="Attaque (+10 × contrat)" selected={draft.petitAuBoutCamp === "ATTAQUE"} onClick={() => set({ petitAuBoutCamp: "ATTAQUE" })} />
          <Chip label="Défense (−10 × contrat)" selected={draft.petitAuBoutCamp === "DEFENSE"} onClick={() => set({ petitAuBoutCamp: "DEFENSE" })} />
        </Chips>
      </Section>

      <Section title="Chelem">
        <Chips>
          {CHELEM_CHOICES.map((c) => (
            <Chip key={c.id} label={c.label} selected={draft.chelem === c.id} onClick={() => setDraft((d) => withChelem(d, c.id))} />
          ))}
        </Chips>
      </Section>
    </Frame>
  );
}

// ---------------------------------------------------------------- Saisie de scores (Skyjo, compteurs)

function ScoreInputs({ match, texts, negatives, onText, onNegative, extra, allowNegativeToggle = true }: {
  match: StoredMatch;
  texts: Record<string, string>;
  negatives: string[];
  onText(id: string, v: string): void;
  onNegative(id: string, v: boolean): void;
  extra?: (id: string) => React.ReactNode;
  allowNegativeToggle?: boolean;
}) {
  return (
    <div className="inputs">
      {match.players.map((p) => {
        const neg = negatives.includes(p.id);
        return (
          <div key={p.id} className="input-row">
            <span className="name">{p.name}</span>
            {allowNegativeToggle && (
              <button type="button" className={`chip sign ${neg ? "on" : ""}`} aria-pressed={neg} aria-label={`Signe du score de ${p.name} : ${neg ? "négatif" : "positif"} (toucher pour changer)`} onClick={() => onNegative(p.id, !neg)}><PlusMinus plus={!neg} /></button>
            )}
            <input
              className="field" inputMode="decimal" autoComplete="off" placeholder="0" aria-label={`Score de ${p.name}`}
              value={texts[p.id] ?? ""} onChange={(e) => onText(p.id, e.target.value)}
            />
            {extra?.(p.id)}
          </div>
        );
      })}
    </div>
  );
}

export function SkyjoEditor(props: EditorProps) {
  const { match, roundIndex, onSave } = props;
  const ids = match.players.map((p) => p.id);
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? id;
  const [draft, setDraft] = useState<SkyjoDraft>(() => {
    const existing = roundIndex !== null ? match.rounds[roundIndex] : undefined;
    return existing !== undefined ? skyjoDraftFrom(skyjoModule.decodeRound(existing), ids) : emptySkyjoDraft(ids);
  });
  const built = useMemo(() => buildSkyjo(draft, nameOf), [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = built.round ? calculerSkyjo(built.round) : null;

  return (
    <Frame
      {...props}
      canSave={!!built.round}
      rulesFocus="doublement"
      onValidate={() => built.round && onSave(skyjoModule.encodeRound(built.round))}
      footer={
        result ? (
          <>
            {result.finisherDoubled && <div className="verdict ko">Points de {nameOf(draft.finisherId!)} doublés</div>}
            <PlayerGrid players={match.players}>
              {(p) => (
                <>
                  <span className="name">{p.name}</span>
                  <span className="with-badge">
                    <Score value={result.points[p.id] ?? 0} withSign />
                    {result.finisherDoubled && p.id === draft.finisherId && <span className="x2" title="Points doublés">×2</span>}
                  </span>
                </>
              )}
            </PlayerGrid>
          </>
        ) : (
          <div className="error">{built.error}</div>
        )
      }
    >
      <Section title="Total des cartes de chaque joueur">
        <ScoreInputs
          match={match} texts={draft.texts} negatives={draft.negatives}
          onText={(id, v) => setDraft((d) => ({ ...d, texts: { ...d.texts, [id]: v } }))}
          onNegative={(id, v) => setDraft((d) => ({ ...d, negatives: v ? [...d.negatives, id] : d.negatives.filter((x) => x !== id) }))}
        />
      </Section>
      <Section title="Qui a terminé la manche ?">
        <Chips>
          {match.players.map((p) => (
            <Chip key={p.id} label={p.name} selected={draft.finisherId === p.id} onClick={() => setDraft((d) => ({ ...d, finisherId: p.id }))} />
          ))}
        </Chips>
        <p className="hint">Rappel : si celui qui termine n'a pas le score strictement le plus bas, ses points sont doublés (s'ils sont positifs).</p>
      </Section>
    </Frame>
  );
}

/** `negate` : mode décompte, on saisit les points marqués et ils sont retirés du total. */
export function CounterEditor(props: EditorProps & { module: GameModule<FreeRound>; allowNegative: boolean; negate?: boolean }) {
  const { match, roundIndex, onSave, module, allowNegative, negate } = props;
  const ids = match.players.map((p) => p.id);
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? id;
  const [draft, setDraft] = useState<FreeDraft>(() => {
    const existing = roundIndex !== null ? match.rounds[roundIndex] : undefined;
    if (existing === undefined) return emptyFreeDraft(ids);
    const round = module.decodeRound(existing);
    return freeDraftFrom(negate ? negateRound(round) : round, ids);
  });
  const built = useMemo(() => buildFree(draft, nameOf, allowNegative), [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Frame
      {...props}
      canSave={!!built.round}
      rulesFocus={match.moduleId === "free" ? `mode-${negate ? "countdown" : match.settings.mode ?? "points"}` : "manche"}
      onValidate={() => built.round && onSave(module.encodeRound(negate ? negateRound(built.round) : built.round))}
      footer={built.error ? <div className="error">{built.error}</div> : <div className="hint">Un champ vide compte 0.</div>}
    >
      <Section title={negate ? "Points marqués (retirés du total)" : "Points de la manche"}>
        <ScoreInputs
          match={match} texts={draft.texts} negatives={draft.negatives} allowNegativeToggle={allowNegative}
          onText={(id, v) => setDraft((d) => ({ ...d, texts: { ...d.texts, [id]: v } }))}
          onNegative={(id, v) => setDraft((d) => ({ ...d, negatives: v ? [...d.negatives, id] : d.negatives.filter((x) => x !== id) }))}
        />
      </Section>
    </Frame>
  );
}

/** Mode « manches gagnées » : on coche qui a gagné la manche (plusieurs en cas d'égalité). */
export function WinnerEditor(props: EditorProps & { module: GameModule<FreeRound> }) {
  const { match, roundIndex, onSave, module } = props;
  const ids = match.players.map((p) => p.id);
  const [winners, setWinners] = useState<string[]>(() => {
    const existing = roundIndex !== null ? match.rounds[roundIndex] : undefined;
    return existing !== undefined ? changesOf(module.decodeRound(existing), ids).map((c) => c.id) : [];
  });
  const toggle = (id: string) => setWinners((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  return (
    <Frame
      {...props}
      canSave={winners.length > 0}
      rulesFocus="mode-wins"
      onValidate={() => onSave(module.encodeRound(winnerRound(ids, winners)))}
      footer={<div className={winners.length ? "hint" : "error"}>{winners.length ? "Chaque gagnant marque une manche." : "Choisis au moins un gagnant."}</div>}
    >
      <Section title="Qui a gagné la manche ?">
        <Chips>
          {match.players.map((p) => (
            <Chip key={p.id} label={p.name} selected={winners.includes(p.id)} onClick={() => toggle(p.id)} />
          ))}
        </Chips>
        <p className="hint">En cas d'égalité, coche plusieurs joueurs.</p>
      </Section>
    </Frame>
  );
}

// ---------------------------------------------------------------- Les Aventuriers du Rail

/** Aide pour compter les routes : nombre de routes de chaque longueur → points. */
function RouteCounter({ withLength8, onUse, onClose }: { withLength8: boolean; onUse(points: number): void; onClose(): void }) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const lengths = ROUTE_POINTS.filter((r) => withLength8 || r.length !== 8);
  const total = routesPoints(Object.fromEntries(lengths.map((r) => [r.length, counts[r.length] ?? 0])));
  return (
    <div className="route-counter">
      {lengths.map((r) => (
        <div key={r.length} className="route-row">
          <span>Routes de {r.length} wagon{r.length > 1 ? "s" : ""} <span className="hint">({r.points} pt{r.points > 1 ? "s" : ""})</span></span>
          <Stepper value={counts[r.length] ?? 0} min={0} max={30} label={`Routes de ${r.length} wagons`} onChange={(v) => setCounts((c) => ({ ...c, [r.length]: v }))} />
        </div>
      ))}
      <div className="buttons">
        <button className="btn outline small" onClick={onClose}>Annuler</button>
        <button className="btn small" onClick={() => onUse(total)}>Utiliser : {total} points</button>
      </div>
    </div>
  );
}

export function RailEditor(props: EditorProps) {
  const { match, roundIndex, onSave } = props;
  const config = railConfig(match.settings);
  const ids = match.players.map((p) => p.id);
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? id;
  const [drafts, setDrafts] = useState<Record<string, RailDraftSheet>>(() => {
    const existing = roundIndex !== null ? match.rounds[roundIndex] : undefined;
    const round = existing !== undefined ? railModule.decodeRound(existing) : null;
    return Object.fromEntries(ids.map((id) => [id, round?.sheets[id] ? draftFromSheet(round.sheets[id]) : emptyDraftSheet()]));
  });
  const [counting, setCounting] = useState<string | null>(null);
  const set = (id: string, patch: Partial<RailDraftSheet>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const built = useMemo(() => buildRail(drafts, ids, nameOf, config), [drafts]); // eslint-disable-line react-hooks/exhaustive-deps
  // Total et bonus de chacun : les bonus sont attribués par comparaison entre les joueurs (plus long chemin, globe-trotter).
  const sheetOf = (id: string) => built.round?.sheets[id];
  const totalOf = (id: string) => { const sh = sheetOf(id); return sh ? sheetTotal(sh) : 0; };

  return (
    <Frame
      {...props}
      canSave={!!built.round}
      rulesFocus="routes"
      onValidate={() => built.round && onSave(railModule.encodeRound(built.round))}
      footer={
        built.round ? (
          <PlayerGrid players={match.players}>
            {(p) => (
              <>
                <span className="name">{p.name}</span>
                <Score value={totalOf(p.id)} />
              </>
            )}
          </PlayerGrid>
        ) : (
          <div className="error">{built.error}</div>
        )
      }
    >
      <p className="hint">Un champ vide compte 0. Les routes peuvent être saisies directement (points déjà comptés sur le plateau) ou calculées avec « Compter ».</p>
      {match.players.map((p) => {
        const d = drafts[p.id];
        return (
          <div key={p.id} className="card rail-card">
            <div className="rail-head">
              <strong>{p.name}</strong>
              <span className="rail-total">{totalOf(p.id)}</span>
            </div>
            <div className="rail-fields">
              <label>
                <span>Routes</span>
                <input className="field" inputMode="numeric" placeholder="0" aria-label={`Points de routes de ${p.name}`} value={d.routes} onChange={(e) => set(p.id, { routes: e.target.value })} />
              </label>
              <label>
                <span>Billets réussis</span>
                <input className="field" inputMode="numeric" placeholder="0" aria-label={`Billets réussis de ${p.name}`} value={d.ticketsDone} onChange={(e) => set(p.id, { ticketsDone: e.target.value })} />
              </label>
              <label>
                <span>Billets ratés</span>
                <input className="field" inputMode="numeric" placeholder="0" aria-label={`Billets ratés de ${p.name}`} value={d.ticketsFailed} onChange={(e) => set(p.id, { ticketsFailed: e.target.value })} />
              </label>
            </div>
            <button type="button" className="link" onClick={() => setCounting(counting === p.id ? null : p.id)}>
              {counting === p.id ? "Fermer l'aide" : "Compter les routes"}
            </button>
            {counting === p.id && (
              <RouteCounter
                withLength8={config.length8}
                onClose={() => setCounting(null)}
                onUse={(points) => { set(p.id, { routes: points ? String(points) : "" }); setCounting(null); }}
              />
            )}
            {(config.longest || config.globetrotter) && (
              <div className="rail-fields two">
                {config.longest && (
                  <label>
                    <span>Plus long chemin (wagons)</span>
                    <input className="field" inputMode="numeric" placeholder="0" aria-label={`Plus long chemin de ${p.name}`} value={d.longestLength} onChange={(e) => set(p.id, { longestLength: e.target.value })} />
                  </label>
                )}
                {config.globetrotter && (
                  <label>
                    <span>Billets réussis (nombre)</span>
                    <input className="field" inputMode="numeric" placeholder="0" aria-label={`Nombre de billets réussis de ${p.name}`} value={d.ticketsCount} onChange={(e) => set(p.id, { ticketsCount: e.target.value })} />
                  </label>
                )}
              </div>
            )}
            {(sheetOf(p.id)?.longest || sheetOf(p.id)?.globetrotter) && (
              <div className="rail-bonus">
                {sheetOf(p.id)?.longest && <span>🏆 Bonus du plus long chemin +10</span>}
                {sheetOf(p.id)?.globetrotter && <span>🏆 Bonus globe-trotter +15</span>}
              </div>
            )}
            {config.stations && (
              <div className="route-row">
                <span>Gares non utilisées <span className="hint">(+4 chacune)</span></span>
                <Stepper value={d.stations} min={0} max={MAX_STATIONS} label={`Gares non utilisées de ${p.name}`} onChange={(v) => set(p.id, { stations: v })} />
              </div>
            )}
          </div>
        );
      })}
    </Frame>
  );
}

// ---------------------------------------------------------------- Sushi Go Party !
export function SushiEditor(props: EditorProps) {
  const { match, roundIndex, onSave } = props;
  const config = sushiConfig(match.settings);
  const ids = match.players.map((p) => p.id);
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? id;
  const existing = roundIndex !== null ? sushiModule.decodeRound(match.rounds[roundIndex]) : null;
  const dessert = existing ? existing.dessert : match.rounds.length >= ROUNDS_BEFORE_DESSERT;
  const fields = useMemo(() => fieldsFor(config, dessert), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [drafts, setDrafts] = useState<Record<string, SushiDraftSheet>>(() =>
    Object.fromEntries(ids.map((id) => [id, sushiDraftFrom(existing?.sheets[id])])));
  const set = (id: string, key: string, value: number) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value ? String(value) : "" } }));
  const built = useMemo(() => buildSushi(drafts, ids, nameOf, fields, dessert), [drafts]); // eslint-disable-line react-hooks/exhaustive-deps
  // Les comparaisons (makis, flans…) se font entre tous les joueurs : les points se mettent à jour à chaque changement.
  const scores = useMemo(() => (built.round ? scoreSushi(built.round) : {}), [built]);

  return (
    <Frame
      {...props}
      canSave={!!built.round}
      rulesFocus={dessert ? "desserts" : "points"}
      onValidate={() => built.round && onSave(sushiModule.encodeRound(built.round))}
      footer={
        built.round ? (
          <PlayerGrid players={match.players}>
            {(p) => (
              <>
                <span className="name">{p.name}</span>
                <Score value={scores[p.id] ?? 0} />
              </>
            )}
          </PlayerGrid>
        ) : (
          <div className="error">{built.error}</div>
        )
      }
    >
      <p className="hint">
        {dessert
          ? "Indique les desserts pris pendant toute la partie : l'appli compare les joueurs et attribue les points."
          : "Indique ce que chacun a devant lui à la fin de la manche. Rien à saisir pour une carte absente : elle compte 0. Les comparaisons entre joueurs sont faites toutes seules."}
      </p>
      {match.players.map((p) => (
        <div key={p.id} className="card rail-card">
          <div className="rail-head">
            <strong>{p.name}</strong>
            <span className="rail-total">{scores[p.id] ?? 0}</span>
          </div>
          {fields.map((f, i) => (
            <div key={f.key}>
              {(i === 0 || fields[i - 1].group !== f.group) && <div className="sushi-group">{f.group}</div>}
              <div className="route-row">
                <span>
                  {f.label}
                  {f.hint && <span className="hint block">{f.hint}</span>}
                </span>
                <Stepper value={Number(drafts[p.id]?.[f.key] || 0)} min={0} max={f.max} label={`${f.label} de ${p.name}`} onChange={(v) => set(p.id, f.key, v)} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </Frame>
  );
}
