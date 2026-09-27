// Règles de calcul (pures, sans accès à l'écran ni au stockage) : découpage des
// créneaux par jour, rapports sur une période et statistiques cigarettes.
// Toutes les durées sont recalculées à partir des horodatages enregistrés.

import { dateKey, dayStart, addDays, eachDay, isWeekday, weekRange, monthRange, parisParts, daysBetween } from "./time.js";
import { WORK_CATEGORIES, ALL_CATEGORIES, OFF_TYPES, dayTypeOf } from "./model.js";

const alive = (r) => r && !r.deleted;
// La pause est du temps vide : elle n'est jamais enregistrée ni comptée.
const countedSlot = (s) => alive(s) && s.category !== "pause";

/** Fin effective d'un créneau : sa fin enregistrée, ou « maintenant » s'il est en cours. */
export const slotEnd = (slot, now) => (slot.end ?? Math.max(now, slot.start));

/**
 * Découpe un créneau aux minuits (heure de Paris) : un créneau 23:00 → 01:00
 * donne 1 h la veille et 1 h le lendemain.
 */
export function segmentsByDay(slot, now) {
  const end = slotEnd(slot, now);
  const out = [];
  let cur = slot.start;
  let key = dateKey(cur);
  while (cur < end) {
    const next = dayStart(addDays(key, 1));
    const segEnd = Math.min(end, next);
    out.push({ key, start: cur, end: segEnd, ms: segEnd - cur });
    cur = segEnd;
    key = addDays(key, 1);
  }
  if (out.length === 0) out.push({ key, start: slot.start, end, ms: 0 });
  return out;
}

const emptyTotals = () => Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0]));

/** Totaux par jour et par catégorie : Map(clé du jour → { bureau: ms, … }). */
export function dayTotalsIndex(slots, now) {
  const idx = new Map();
  for (const slot of slots) {
    if (!countedSlot(slot)) continue;
    for (const seg of segmentsByDay(slot, now)) {
      if (!idx.has(seg.key)) idx.set(seg.key, emptyTotals());
      const t = idx.get(seg.key);
      t[slot.category] = (t[slot.category] ?? 0) + seg.ms;
    }
  }
  return idx;
}

export const workOf = (totals) => WORK_CATEGORIES.reduce((s, c) => s + (totals?.[c] ?? 0), 0);

/** Totaux d'un seul jour. */
export function dayTotals(slots, key, now) {
  return dayTotalsIndex(slots, now).get(key) ?? emptyTotals();
}

/** Segments (créneaux découpés) d'un jour donné, triés chronologiquement. */
export function daySegments(slots, key, now) {
  const out = [];
  for (const slot of slots) {
    if (!countedSlot(slot)) continue;
    const segs = segmentsByDay(slot, now);
    segs.forEach((seg, i) => {
      if (seg.key !== key) return;
      out.push({
        ...seg,
        slot,
        continuesFromPreviousDay: i > 0,
        continuesNextDay: i < segs.length - 1,
        running: slot.end == null,
      });
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Rapport sur une période [start, end] (clés de jours incluses).
 * - moyennes calculées sur les jours ouvrés (lun.–ven.) moins les jours off ;
 * - un jour ouvré sans pointage compte pour zéro ;
 * - samedi et dimanche : comptés à part (heures sup du week-end) ;
 * - les pauses sont du temps vide : jamais enregistrées ni comptées ;
 * - la période est arrêtée à « today » : les jours à venir ne comptent pas.
 */
export function computeReport({ slots, days, start, end, today, now }) {
  const effEnd = end > today ? today : end;
  const idx = dayTotalsIndex(slots, now);
  const byCat = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0]));
  const offByType = { cp: 0, rtt: 0, autre: 0 };
  let weekdays = 0, offDays = 0, baseDays = 0, baseWorkMs = 0, weekendMs = 0, offDayWorkMs = 0;

  const keys = effEnd >= start ? eachDay(start, effEnd) : [];
  for (const key of keys) {
    const totals = idx.get(key) ?? emptyTotals();
    const work = workOf(totals);
    const type = dayTypeOf(days, key);
    if (isWeekday(key)) {
      weekdays++;
      if (OFF_TYPES.includes(type)) {
        offDays++;
        offByType[type]++;
        offDayWorkMs += work;
      } else {
        baseDays++;
        baseWorkMs += work;
        for (const c of WORK_CATEGORIES) byCat[c] += totals[c];
      }
    } else {
      weekendMs += work;
    }
  }

  const avgPerDayMs = baseDays ? baseWorkMs / baseDays : 0;
  const categories = Object.fromEntries(
    WORK_CATEGORIES.map((c) => [
      c,
      {
        totalMs: byCat[c],
        avgPerDayMs: baseDays ? byCat[c] / baseDays : 0,
        pct: baseWorkMs ? (byCat[c] / baseWorkMs) * 100 : 0,
      },
    ])
  );

  return {
    start,
    end,
    effectiveEnd: effEnd,
    truncated: effEnd < end,
    empty: keys.length === 0,
    weekdays,
    offDays,
    offByType,
    baseDays,
    baseWorkMs,
    avgPerDayMs,
    avgPerWeekMs: avgPerDayMs * 5,
    weekendMs,
    offDayWorkMs,
    categories,
  };
}

/** « 22 jours ouvrés, dont 2 off, soit 20 jours » */
export function baseSentence(r) {
  const j = (n) => (n > 1 ? "jours" : "jour");
  return `${r.weekdays} ${j(r.weekdays)} ${r.weekdays > 1 ? "ouvrés" : "ouvré"}, dont ${r.offDays} off, soit ${r.baseDays} ${j(r.baseDays)}`;
}

/** Jours off déclarés sur l'année civile, par type. */
export function yearOffCount(days, year) {
  const out = { cp: 0, rtt: 0, autre: 0, total: 0 };
  const entries = days instanceof Map ? [...days.values()] : Object.values(days ?? {});
  for (const d of entries) {
    if (!alive(d) || !d.id?.startsWith(`${year}-`)) continue;
    if (OFF_TYPES.includes(d.type)) {
      out[d.type]++;
      out.total++;
    }
  }
  return out;
}

// ---- Cigarettes ----------------------------------------------------------------

export function cigaretteStats(cigs, now) {
  const times = cigs.filter(alive).map((c) => c.at).sort((a, b) => a - b);
  const today = dateKey(now);
  const perDay = new Map();
  for (const t of times) {
    const k = dateKey(t);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const count = (k) => perDay.get(k) ?? 0;

  const last = times.length ? times[times.length - 1] : null;
  let recordMs = 0;
  let recordOngoing = false;
  for (let i = 1; i < times.length; i++) recordMs = Math.max(recordMs, times[i] - times[i - 1]);
  if (last != null && now - last >= recordMs) {
    recordMs = now - last;
    recordOngoing = true;
  }

  // Moyennes : du début de la période (ou du premier enregistrement) jusqu'à aujourd'hui.
  const firstKey = times.length ? dateKey(times[0]) : today;
  const avgOver = (range) => {
    const from = range.start > firstKey ? range.start : firstKey;
    if (from > today) return 0;
    let n = 0;
    for (const k of eachDay(from, today)) n += count(k);
    return n / (daysBetween(from, today) + 1);
  };

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(today, -i);
    last7.push({ key: k, count: count(k) });
  }

  // Tranche horaire la plus fréquente sur les 30 derniers jours.
  const since = addDays(today, -29);
  const hours = new Array(24).fill(0);
  for (const t of times) if (dateKey(t) >= since) hours[parisParts(t).hh]++;
  const max = Math.max(...hours);
  const topHour = max > 0 ? { hour: hours.indexOf(max), count: max } : null;

  return {
    total: times.length,
    today: count(today),
    last,
    sinceLastMs: last != null ? now - last : null,
    recordMs,
    recordOngoing,
    avgWeek: avgOver(weekRange(today)),
    avgMonth: avgOver(monthRange(today)),
    last7,
    topHour,
    countForDay: count,
  };
}

/** Nombre de cigarettes sur une période. */
export function cigaretteCount(cigs, start, end) {
  return cigs.filter((c) => alive(c) && dateKey(c.at) >= start && dateKey(c.at) <= end).length;
}
