import { useRef } from "react";
import type { Claim } from "./backend";
import type { StoredMatch } from "./core";
import { mergeStickyEntries, type Entries } from "./guestEntry";

/** Saisies de la manche en cours, conservées pendant les coupures de connexion (voir `mergeStickyEntries`). */
export function useStickyEntries(claims: Claim[], match: StoredMatch | undefined | null): Entries {
  const memo = useRef<{ key: string; entries: Entries }>({ key: "", entries: {} });
  if (!match) return {};
  const round = match.rounds.length;
  const key = `${match.id}:${round}`;
  if (memo.current.key !== key) memo.current = { key, entries: {} };
  memo.current.entries = mergeStickyEntries(memo.current.entries, claims, match, round);
  return memo.current.entries;
}
