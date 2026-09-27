// Actions de l'utilisateur sur les données (pointer, pause, cigarettes, journées).

import { save, remove, list, mem } from "./db.js";
import { dateKey } from "./time.js";

/** Créneau en cours (sans heure de fin), s'il y en a un. */
export function openSlot() {
  return list("slots")
    .filter((s) => s.end == null)
    .sort((a, b) => b.start - a.start)[0] ?? null;
}

/** Clôt l'activité en cours et en démarre une nouvelle. */
export async function startActivity(category) {
  const now = Date.now();
  const cur = openSlot();
  if (cur?.category === category) return cur;
  if (cur) await save("slots", { id: cur.id, end: Math.max(now, cur.start) });
  return save("slots", { category, start: now, end: null, note: "" });
}

/** Fin de journée : clôt l'activité en cours. Renvoie le jour concerné. */
export async function endDay(at = Date.now()) {
  const cur = openSlot();
  if (!cur) return dateKey(at);
  await save("slots", { id: cur.id, end: Math.max(at, cur.start) });
  return dateKey(cur.start);
}

export const setNote = (id, note) => save("slots", { id, note });

export const addCigarette = () => save("cigarettes", { at: Date.now() });

/** Retire la dernière cigarette du jour (bouton « − »). */
export async function removeLastCigarette() {
  const today = dateKey(Date.now());
  const last = list("cigarettes")
    .filter((c) => dateKey(c.at) === today)
    .sort((a, b) => b.at - a.at)[0];
  if (last) await remove("cigarettes", last.id);
  return !!last;
}

export function getDay(key) {
  const d = mem.days.get(key);
  return d && !d.deleted ? d : null;
}

export const setDayType = (key, type) => save("days", { id: key, type });

export const validateDay = (key) =>
  save("days", { id: key, type: getDay(key)?.type ?? "travaillee", validated: true, validatedAt: Date.now() });
