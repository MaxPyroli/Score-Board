import { useMemo, useState } from "react";
import { Chip, Chips, PlayerGrid, Score, Section, TopBar } from "./components";
import { plain, type GameModule, type StoredMatch } from "../core";
import type { EditorProps } from "../games/registry";
import {
  atoutsRequis, buildRound, calculer, CHELEM_CHOICES, CONTRACTS, draftFromRound, draftStep, initialDraft, POIGNEES,
  pointsDefense, pointsVerrouilles, seuilRequis, tarotModule, TOTAL_POINTS, withChelem, withPoints, withPointsDelta,
  type TarotDraft,
} from "../games/tarot";
import { buildSkyjo, calculerSkyjo, emptySkyjoDraft, skyjoDraftFrom, skyjoModule, type SkyjoDraft } from "../games/skyjo";
import { buildFree, changesOf, emptyFreeDraft, freeDraftFrom, negateRound, winnerRound, type FreeDraft, type FreeRound } from "../games/counter";

const title = (match: StoredMatch, index: number | null) =>
  index !== null ? `Modifier la manche ${index + 1}` : `Manche ${match.rounds.length + 1}`;

function Frame(props: EditorProps & { children: React.ReactNode; footer: React.ReactNode; canSave: boolean; onValidate(): void }) {
  const { match, roundIndex, onCancel, onDelete, children, footer, canSave, onValidate } = props;
  return (
    <div className="screen">
      <TopBar title={title(match, roundIndex)} onBack={onCancel} />
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
              <button type="button" className={`chip sign ${neg ? "on" : ""}`} aria-pressed={neg} aria-label={`Score négatif pour ${p.name}`} onClick={() => onNegative(p.id, !neg)}>−</button>
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
      onValidate={() => built.round && onSave(skyjoModule.encodeRound(built.round))}
      footer={
        result ? (
          <>
            {result.finisherDoubled && <div className="verdict ko">Points de {nameOf(draft.finisherId!)} doublés</div>}
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
