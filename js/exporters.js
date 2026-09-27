// Extraction des données d'une période : texte Markdown (pour une IA) et CSV (tableur).

import { computeReport, baseSentence, daySegments, dayTotalsIndex, workOf, cigaretteCount } from "./calc.js";
import { CATEGORIES, WORK_CATEGORIES, OFF_TYPES, categoryLabel, dayTypeLabel, dayTypeOf } from "./model.js";
import {
  eachDay, isWeekday, formatLongDate, formatNumericDate, formatHM, formatDuration,
  formatDecimalHours, formatNumber, capitalize, weekdayName, toMinutes, daysBetween,
} from "./time.js";

const alive = (r) => r && !r.deleted;
const oneLine = (s) => (s ?? "").replace(/\s*\n+\s*/g, " / ").trim();

function segmentNote(seg) {
  const bits = [];
  if (seg.continuesFromPreviousDay) bits.push("suite de la veille");
  if (seg.continuesNextDay) bits.push("se poursuit le lendemain");
  if (seg.running) bits.push("en cours");
  return bits;
}

export function buildMarkdown({ slots, days, cigs, start, end, today, now }) {
  const r = computeReport({ slots, days, start, end, today, now });
  const effEnd = r.effectiveEnd;
  const idx = dayTotalsIndex(slots, now);
  const nCigs = r.empty ? 0 : cigaretteCount(cigs, start, effEnd);
  const nDays = r.empty ? 0 : daysBetween(start, effEnd) + 1;
  const L = [];

  L.push(`# Pointage du ${formatLongDate(start)} au ${formatLongDate(end)}`);
  L.push("");
  if (r.truncated && !r.empty) L.push(`_Données arrêtées au ${formatLongDate(effEnd)} (jours suivants à venir, non comptés)._`, "");
  L.push("## Synthèse", "");
  L.push(`- Base de calcul : ${baseSentence(r)}`);
  L.push(`- Temps travaillé sur les jours ouvrés : ${formatDuration(r.baseWorkMs)}`);
  L.push(`- **Moyenne par jour ouvré : ${formatDuration(r.avgPerDayMs)}**`);
  L.push(`- Moyenne par semaine (5 jours ouvrés) : ${formatDuration(r.avgPerWeekMs)}`);
  L.push(`- Heures supplémentaires (week-end) : ${formatDuration(r.weekendMs)}`);
  if (r.offDayWorkMs > 0) L.push(`- Temps travaillé pendant des jours off (hors moyennes) : ${formatDuration(r.offDayWorkMs)}`);
  L.push(`- Jours off : ${r.offDays} (CP : ${r.offByType.cp}, RTT : ${r.offByType.rtt}, Autre : ${r.offByType.autre})`);
  L.push(`- Pauses (non comptées comme travail) : ${formatDuration(r.pauseMs)}`);
  L.push(`- Cigarettes : ${nCigs} au total, soit ${formatNumber(nDays ? nCigs / nDays : 0)} par jour en moyenne`);
  L.push("");
  L.push("## Par catégorie (jours ouvrés hors jours off)", "");
  L.push("| Catégorie | Total | Moyenne par jour | Part |");
  L.push("|---|---|---|---|");
  for (const c of WORK_CATEGORIES) {
    const x = r.categories[c];
    L.push(`| ${categoryLabel(c)} | ${formatDuration(x.totalMs)} | ${formatDuration(x.avgPerDayMs)} | ${Math.round(x.pct)} % |`);
  }
  L.push("");
  L.push("## Détail jour par jour", "");

  for (const key of r.empty ? [] : eachDay(start, effEnd)) {
    const segs = daySegments(slots, key, now);
    const type = dayTypeOf(days, key);
    const cigN = cigaretteCount(cigs, key, key);
    const weekend = !isWeekday(key);
    if (weekend && segs.length === 0 && cigN === 0 && type === "travaillee") continue;
    const typeLabel = weekend && type === "travaillee" ? "Week-end" : dayTypeLabel(type);
    L.push(`### ${capitalize(formatLongDate(key))} — ${typeLabel}`, "");
    if (segs.length === 0) L.push("- Aucun pointage");
    for (const seg of segs) {
      const parts = [
        `${formatHM(seg.start)}–${formatHM(seg.end)}`,
        categoryLabel(seg.slot.category),
        formatDuration(seg.ms),
      ];
      const note = oneLine(seg.slot.note);
      if (note) parts.push(note);
      const extra = segmentNote(seg);
      L.push(`- ${parts.join(" · ")}${extra.length ? ` (${extra.join(", ")})` : ""}`);
    }
    const work = workOf(idx.get(key));
    L.push(`- Total travaillé : ${formatDuration(work)}${weekend && work > 0 ? " (heures sup week-end)" : ""} · Cigarettes : ${cigN}`);
    L.push("");
  }
  return L.join("\n").trimEnd() + "\n";
}

// ---- CSV -------------------------------------------------------------------

const CSV_HEADER = ["Date", "Jour", "Type de journée", "Catégorie", "Début", "Fin", "Durée (min)", "Durée (h)", "Note"];

export function csvField(v) {
  const s = String(v ?? "");
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Une ligne par créneau (un créneau à cheval sur minuit donne une ligne par jour).
 * Les jours off sans aucun créneau ont aussi une ligne, pour garder l'information.
 * Séparateur « ; », décimales à virgule, encodage UTF-8 avec BOM.
 */
export function buildCSV({ slots, days, start, end, today, now }) {
  const effEnd = end > today ? today : end;
  const rows = [CSV_HEADER];
  for (const key of effEnd >= start ? eachDay(start, effEnd) : []) {
    const type = dayTypeOf(days, key);
    const typeLabel = !isWeekday(key) && type === "travaillee" ? "Week-end" : dayTypeLabel(type);
    const segs = daySegments(slots, key, now);
    if (segs.length === 0 && OFF_TYPES.includes(type)) {
      rows.push([formatNumericDate(key), weekdayName(key), typeLabel, "", "", "", 0, "0,00", ""]);
    }
    for (const seg of segs) {
      const note = [oneLine(seg.slot.note), ...segmentNote(seg).map((s) => `(${s})`)].filter(Boolean).join(" ");
      rows.push([
        formatNumericDate(key),
        weekdayName(key),
        typeLabel,
        categoryLabel(seg.slot.category),
        formatHM(seg.start),
        formatHM(seg.end),
        toMinutes(seg.ms),
        formatDecimalHours(seg.ms),
        note,
      ]);
    }
  }
  return "﻿" + rows.map((r) => r.map(csvField).join(";")).join("\r\n") + "\r\n";
}

export function exportFileName(start, end, ext) {
  return `pointage_${start}_${end}.${ext}`;
}

// ---- Sauvegarde complète (JSON) -------------------------------------------------

export const BACKUP_APP = "pointage";
export const SCHEMA_VERSION = 1;

export function buildBackup({ slots, days, cigs, meta, now }) {
  return {
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    deviceId: meta?.deviceId ?? null,
    data: { slots, days, cigarettes: cigs },
  };
}

/** Vérifie un fichier de sauvegarde ; renvoie ses données ou lève une erreur lisible. */
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde valide (JSON illisible).");
  }
  if (!obj || obj.app !== BACKUP_APP || !obj.data) throw new Error("Ce fichier ne provient pas de l'application Pointage.");
  if (obj.schemaVersion > SCHEMA_VERSION) throw new Error("Cette sauvegarde vient d'une version plus récente de l'application.");
  const { slots = [], days = [], cigarettes = [] } = obj.data;
  if (![slots, days, cigarettes].every(Array.isArray)) throw new Error("Sauvegarde incomplète.");
  const okSlot = (s) => s && typeof s.id === "string" && typeof s.start === "number" && CATEGORIES[s.category];
  if (!slots.every(okSlot)) throw new Error("Sauvegarde corrompue : un créneau est invalide.");
  if (!cigarettes.every((c) => c && typeof c.id === "string" && typeof c.at === "number")) throw new Error("Sauvegarde corrompue : une cigarette est invalide.");
  if (!days.every((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.id))) throw new Error("Sauvegarde corrompue : un jour est invalide.");
  return { slots, days, cigarettes, exportedAt: obj.exportedAt };
}

