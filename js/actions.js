// Actions de l'utilisateur sur les données (pointer, pause, cigarettes, journées).

import { save, remove, list, mem, getMeta, setMeta } from "./db.js";
import { dateKey } from "./time.js";

/** Créneau en cours (sans heure de fin), s'il y en a un. */
export function openSlot() {
  return list("slots")
    .filter((s) => s.end == null && s.category !== "pause")
    .sort((a, b) => b.start - a.start)[0] ?? null;
}

/** Clôt tout créneau resté ouvert (y compris d'anciennes pauses enregistrées). */
async function closeOpen(at) {
  for (const s of list("slots").filter((x) => x.end == null)) {
    await save("slots", { id: s.id, end: Math.max(at, s.start) });
  }
}

/**
 * Pause en cours : heure de début, uniquement si elle date d'aujourd'hui.
 * La pause est du temps vide : rien n'est enregistré comme créneau.
 */
export function pausedSince(now = Date.now()) {
  const t = getMeta("pauseStartedAt");
  return t && !openSlot() && dateKey(t) === dateKey(now) ? t : null;
}

/** Clôt l'activité en cours et en démarre une nouvelle. */
export async function startActivity(category) {
  const now = Date.now();
  const cur = openSlot();
  if (cur?.category === category) return cur;
  await closeOpen(now);
  await setMeta("pauseStartedAt", null);
  return save("slots", { category, start: now, end: null, note: "" });
}

/** Pause : arrête l'activité en cours ; le temps de pause n'est pas enregistré. */
export async function startPause() {
  const now = Date.now();
  await closeOpen(now);
  await setMeta("pauseStartedAt", now);
}

/** Fin de journée : clôt l'activité en cours. Renvoie le jour concerné. */
export async function endDay(at = Date.now()) {
  const cur = openSlot();
  await setMeta("pauseStartedAt", null);
  await closeOpen(at);
  return dateKey(cur ? cur.start : at);
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
