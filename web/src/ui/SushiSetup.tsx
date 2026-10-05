import type { SetupProps } from "../games/registry";
import {
  DESSERT_CHOICES, MENU_CARDS, MENU_COUNTS, PRESET_MENUS, ROLL_CHOICES, SETTING_ASSISTANT, SETTING_DESSERT, SETTING_PRESET, SETTING_ROLL,
  allowedFor, presetSettings, type MenuCard,
} from "../games/sushi";
import { Section } from "./components";

const CUSTOM = "custom";

function Choices({ items, value, onPick }: { items: { value: string; label: string; description: string }[]; value: string; onPick(v: string): void }) {
  return (
    <div className="choices">
      {items.map((ch) => (
        <button key={ch.value} type="button" className={`card choice ${value === ch.value ? "on" : ""}`} aria-pressed={value === ch.value} onClick={() => onPick(ch.value)}>
          <strong>{ch.label}</strong>
          <span className="hint">{ch.description}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Menu de Sushi Go Party !. Mode simple : makis, dessert et cartes au choix, sans contrainte.
 * Mode assistant : les huit menus du règlement, ou un menu « à la carte » par catégories (1 makis, 3 hors-d'œuvre,
 * 2 suppléments, 1 dessert), avec les limites selon le nombre de joueurs.
 */
export function SushiSetup({ values, setMany, players }: SetupProps) {
  const assistant = values[SETTING_ASSISTANT] === "true";
  const preset = values[SETTING_PRESET] ?? CUSTOM;
  // Toute modification à la main fait passer en « à la carte ».
  const edit = (patch: Record<string, string>) => setMany({ ...patch, [SETTING_PRESET]: CUSTOM });
  const on = (c: MenuCard) => values[c.key] === "true";
  const count = (kind: MenuCard["kind"]) => MENU_CARDS.filter((c) => c.kind === kind && on(c)).length;

  const cardList = (kind: MenuCard["kind"], max?: number) =>
    MENU_CARDS.filter((c) => c.kind === kind).map((c) => {
      const allowed = !assistant || allowedFor(c.key, players);
      const full = assistant && max !== undefined && count(kind) >= max && !on(c);
      return (
        <label key={c.key} className={`switch-row ${allowed && !full ? "" : "disabled"}`}>
          <span>
            <strong>{c.label}</strong>
            <span className="hint block">{c.description}{!allowed ? " Indisponible à ce nombre de joueurs." : ""}</span>
          </span>
          <input type="checkbox" checked={on(c)} disabled={!allowed || full} onChange={(e) => edit({ [c.key]: String(e.target.checked) })} />
        </label>
      );
    });

  return (
    <>
      <Section title="Menu">
        <label className="switch-row">
          <span>
            <strong>Mode assistant</strong>
            <span className="hint block">Menus du règlement et choix du menu par catégories, avec les limites selon le nombre de joueurs.</span>
          </span>
          <input type="checkbox" checked={assistant} onChange={(e) => setMany({ [SETTING_ASSISTANT]: String(e.target.checked) })} />
        </label>
      </Section>
      {assistant && (
        <Section title="Menus du règlement">
          <Choices
            value={preset}
            items={[
              ...PRESET_MENUS.map((p) => ({ value: p.id, label: p.name, description: p.blurb })),
              { value: CUSTOM, label: "À la carte", description: "Je choisis moi-même mes cartes, catégorie par catégorie." },
            ]}
            onPick={(id) => {
              const p = PRESET_MENUS.find((m) => m.id === id);
              setMany(p ? { ...presetSettings(p), [SETTING_PRESET]: id } : { [SETTING_PRESET]: CUSTOM });
            }}
          />
        </Section>
      )}
      <Section title={assistant ? `Makis · ${MENU_COUNTS.roll} sur ${MENU_COUNTS.roll}` : "Makis du menu"}>
        <Choices items={ROLL_CHOICES} value={values[SETTING_ROLL]} onPick={(v) => edit({ [SETTING_ROLL]: v })} />
      </Section>
      <Section title={assistant ? `Hors-d'œuvre · ${count("apero")} sur ${MENU_COUNTS.apero}` : "Hors-d'œuvre"}>{cardList("apero", MENU_COUNTS.apero)}</Section>
      <Section title={assistant ? `Suppléments · ${count("special")} sur ${MENU_COUNTS.special}` : "Suppléments"}>{cardList("special", MENU_COUNTS.special)}</Section>
      <Section title={assistant ? `Dessert · 1 sur ${MENU_COUNTS.dessert}` : "Dessert du menu"}>
        <Choices items={DESSERT_CHOICES} value={values[SETTING_DESSERT]} onPick={(v) => edit({ [SETTING_DESSERT]: v })} />
      </Section>
    </>
  );
}
