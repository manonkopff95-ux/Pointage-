// Outils de dates et d'heures, toujours calculés dans le fuseau Europe/Paris,
// quel que soit le réglage du téléphone. Les jours sont représentés par une
// clé « AAAA-MM-JJ » ; les instants par un horodatage en millisecondes.

export const TZ = "Europe/Paris";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const pad = (n) => String(n).padStart(2, "0");

/** Décompose un instant en année, mois, jour, heure… à l'heure de Paris. */
export function parisParts(ms) {
  const p = {};
  for (const { type, value } of partsFormatter.formatToParts(new Date(ms))) p[type] = value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute, ss: +p.second };
}

/** Décalage (en ms) entre l'heure de Paris et l'heure UTC à un instant donné. */
function parisOffset(ms) {
  const base = Math.floor(ms / 1000) * 1000;
  const p = parisParts(base);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - base;
}

/** Clé du jour (à Paris) contenant l'instant. */
export function dateKey(ms) {
  const p = parisParts(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function splitKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

/** Instant correspondant à « jour + heure:minute » à l'heure de Paris. */
export function parisToEpoch(key, hh = 0, mm = 0) {
  const { y, m, d } = splitKey(key);
  const local = Date.UTC(y, m - 1, d, hh, mm);
  let t = local - parisOffset(local);
  t = local - parisOffset(t);
  return t;
}

/** Minuit (heure de Paris) au début du jour. */
export const dayStart = (key) => parisToEpoch(key, 0, 0);

export function addDays(key, n) {
  const { y, m, d } = splitKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = dimanche … 6 = samedi */
export function weekday(key) {
  const { y, m, d } = splitKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const isWeekday = (key) => {
  const w = weekday(key);
  return w >= 1 && w <= 5;
};

/** Liste des clés de jours de start à end inclus. */
export function eachDay(startKey, endKey) {
  const out = [];
  for (let k = startKey; k <= endKey; k = addDays(k, 1)) out.push(k);
  return out;
}

export function daysBetween(startKey, endKey) {
  const a = splitKey(startKey);
  const b = splitKey(endKey);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

// ---- Périodes -------------------------------------------------------------

export function weekRange(key) {
  const w = weekday(key);
  const start = addDays(key, -((w + 6) % 7));
  return { start, end: addDays(start, 6) };
}

export function monthRange(key) {
  const { y, m } = splitKey(key);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

export function yearRange(key) {
  const { y } = splitKey(key);
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export function previousMonthRange(key) {
  const { y, m } = splitKey(key);
  return monthRange(`${m === 1 ? y - 1 : y}-${pad(m === 1 ? 12 : m - 1)}-01`);
}

// ---- Affichage en français -------------------------------------------------

const longDateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const monthFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" });
const weekdayShortFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short" });

const keyToNoon = (key) => {
  const { y, m, d } = splitKey(key);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

// « 1 septembre » → « 1er septembre », selon l'usage français.
const premier = (s) => s.replace(/(^|\s)1 /, "$11er ");

/** « lundi 1er septembre 2026 » */
export const formatLongDate = (key) => premier(longDateFmt.format(keyToNoon(key)));
/** « lundi 1er septembre » */
export const formatDayMonth = (key) => premier(shortDateFmt.format(keyToNoon(key)));
/** « septembre 2026 » */
export const formatMonth = (key) => monthFmt.format(keyToNoon(key));
/** « lun. » */
export const formatWeekdayShort = (key) => weekdayShortFmt.format(keyToNoon(key));
/** « lundi » */
export const weekdayName = (key) =>
  ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][weekday(key)];
/** « 01/09/2026 » */
export function formatNumericDate(key) {
  const { y, m, d } = splitKey(key);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** « 09:05 » (heure de Paris, format 24 h) */
export function formatHM(ms) {
  const p = parisParts(ms);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

/** Arrondit une durée à la minute. */
export const toMinutes = (ms) => Math.round(ms / 60000);

/** « 1 h 45 », « 2 h », « 45 min » */
export function formatDuration(ms) {
  const total = Math.max(0, toMinutes(ms));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${pad(m)}`;
}

/** « 1:05:09 » pour un chronomètre */
export function formatClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** « 1 j 4 h 12 min », pour les longues durées */
export function formatLongDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d > 0) return `${d} j ${h} h ${pad(m)}`;
  return formatDuration(total * 60000);
}

/** Heures décimales à la française : « 1,75 » */
export function formatDecimalHours(ms) {
  return (toMinutes(ms) / 60).toFixed(2).replace(".", ",");
}

/** Nombre à la française avec n décimales : « 2,5 » */
export function formatNumber(n, decimals = 1) {
  return Number(n.toFixed(decimals)).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
}

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
