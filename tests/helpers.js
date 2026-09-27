import { parisToEpoch } from "../js/time.js";

let n = 0;
/** Instant « jour + HH:MM » à l'heure de Paris. */
export const at = (key, hm) => {
  const [h, m] = hm.split(":").map(Number);
  return parisToEpoch(key, h, m);
};
/** Créneau terminé. endKey permet de finir un autre jour (minuit franchi). */
export const slot = (category, key, from, to, { note = "", endKey = key } = {}) => ({
  id: `s${++n}`,
  category,
  start: at(key, from),
  end: to == null ? null : at(endKey, to),
  note,
});
export const cig = (key, hm) => ({ id: `c${++n}`, at: at(key, hm) });
export const days = (obj) => new Map(Object.entries(obj).map(([id, type]) => [id, { id, type }]));
