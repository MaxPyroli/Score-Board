import { useRef } from "react";
import type { Claim } from "./backend";
import type { StoredMatch } from "./core";
import { mergeStickyEntries, NO_STICKY, type Entries, type StickyEntries } from "./guestEntry";

/** Saisies de la manche en cours, conservées pendant les coupures de connexion (voir `mergeStickyEntries`). */
export function useStickyEntries(claims: Claim[], match: StoredMatch | undefined | null): Entries {
  const memo = useRef<{ key: string; state: StickyEntries }>({ key: "", state: NO_STICKY });
  if (!match) return {};
  const round = match.rounds.length;
  const key = `${match.id}:${round}`;
  if (memo.current.key !== key) memo.current = { key, state: NO_STICKY };
  memo.current.state = mergeStickyEntries(memo.current.state, claims, match, round);
  return memo.current.state.entries;
}
