import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReport, baseSentence, segmentsByDay, dayTotals, daySegments, yearOffCount, cigaretteStats } from "../js/calc.js";
import { at, slot, cig, days } from "./helpers.js";

const H = 3600000;
const M = 60000;

// Septembre 2026 : le 1er est un mardi ; 22 jours ouvrés du 1er au 30.
const SEPT = { start: "2026-09-01", end: "2026-09-30", today: "2026-10-15", now: at("2026-10-15", "12:00") };

test("moyenne sur les jours ouvrés : un jour ouvré sans pointage compte pour zéro", () => {
  // Semaine du lundi 21 au dimanche 27 septembre : 8 h lundi, 6 h mardi, rien ensuite.
  const slots = [slot("bureau", "2026-09-21", "09:00", "17:00"), slot("rdv", "2026-09-22", "10:00", "16:00")];
  const r = computeReport({ slots, days: new Map(), start: "2026-09-21", end: "2026-09-27", today: "2026-09-30", now: at("2026-09-30", "12:00") });
  assert.equal(r.weekdays, 5);
  assert.equal(r.baseDays, 5);
  assert.equal(r.baseWorkMs, 14 * H);
  assert.equal(r.avgPerDayMs, (14 * H) / 5);
  assert.equal(r.avgPerWeekMs, 14 * H);
});

test("jours off déduits de la base de calcul", () => {
  const slots = [slot("bureau", "2026-09-01", "09:00", "17:00")]; // 8 h
  const r = computeReport({ slots, days: days({ "2026-09-02": "cp", "2026-09-03": "rtt" }), ...SEPT });
  assert.equal(r.weekdays, 22);
  assert.equal(r.offDays, 2);
  assert.deepEqual(r.offByType, { cp: 1, rtt: 1, autre: 0 });
  assert.equal(r.baseDays, 20);
  assert.equal(r.avgPerDayMs, (8 * H) / 20);
  assert.equal(baseSentence(r), "22 jours ouvrés, dont 2 off, soit 20 jours");
});

test("week-end : compté à part en heures sup, jamais dans les moyennes", () => {
  const slots = [
    slot("bureau", "2026-09-25", "09:00", "17:00"), // vendredi 8 h
    slot("bureau", "2026-09-26", "10:00", "13:00"), // samedi 3 h
    slot("voiture", "2026-09-27", "14:00", "15:30"), // dimanche 1 h 30
  ];
  const r = computeReport({ slots, days: new Map(), start: "2026-09-21", end: "2026-09-27", today: "2026-09-30", now: at("2026-09-30", "12:00") });
  assert.equal(r.weekendMs, 4.5 * H);
  assert.equal(r.baseWorkMs, 8 * H);
  assert.equal(r.avgPerDayMs, (8 * H) / 5);
  assert.equal(r.categories.voiture.totalMs, 0);
});

test("les pauses sont du temps vide : ni comptées ni listées", () => {
  const slots = [
    slot("bureau", "2026-09-21", "09:00", "12:00"),
    slot("pause", "2026-09-21", "12:00", "13:30"),
    slot("formation", "2026-09-21", "13:30", "14:30"),
  ];
  const r = computeReport({ slots, days: new Map(), start: "2026-09-21", end: "2026-09-21", today: "2026-09-30", now: 0 });
  assert.equal(r.baseWorkMs, 4 * H);
  assert.equal(r.pauseMs, undefined);
  assert.equal(dayTotals(slots, "2026-09-21", 0).pause ?? 0, 0);
  assert.deepEqual(daySegments(slots, "2026-09-21", 0).map((s) => s.slot.category), ["bureau", "formation"]);
  assert.equal(Math.round(r.categories.bureau.pct), 75);
  assert.equal(Math.round(r.categories.formation.pct), 25);
});

test("créneau à cheval sur minuit : réparti sur les deux jours", () => {
  const s = slot("voiture", "2026-09-24", "23:00", "01:30", { endKey: "2026-09-25" });
  const segs = segmentsByDay(s, 0);
  assert.equal(segs.length, 2);
  assert.deepEqual(segs.map((x) => [x.key, x.ms]), [["2026-09-24", 1 * H], ["2026-09-25", 1.5 * H]]);
  assert.equal(dayTotals([s], "2026-09-25", 0).voiture, 1.5 * H);
  const d = daySegments([s], "2026-09-25", 0);
  assert.equal(d[0].continuesFromPreviousDay, true);
});

test("créneau du vendredi soir qui déborde sur le samedi : la partie du samedi est en heures sup", () => {
  const s = slot("bureau", "2026-09-25", "22:00", "02:00", { endKey: "2026-09-26" });
  const r = computeReport({ slots: [s], days: new Map(), start: "2026-09-21", end: "2026-09-27", today: "2026-09-30", now: 0 });
  assert.equal(r.baseWorkMs, 2 * H);
  assert.equal(r.weekendMs, 2 * H);
});

test("créneau en cours : durée calculée jusqu'à maintenant", () => {
  const s = slot("bureau", "2026-09-21", "09:00", null);
  const r = computeReport({ slots: [s], days: new Map(), start: "2026-09-21", end: "2026-09-21", today: "2026-09-21", now: at("2026-09-21", "10:15") });
  assert.equal(r.baseWorkMs, 75 * M);
});

test("les jours à venir ne sont pas comptés dans la base", () => {
  const r = computeReport({ slots: [], days: new Map(), start: "2026-09-01", end: "2026-09-30", today: "2026-09-09", now: 0 });
  assert.equal(r.weekdays, 7); // mar. 1 → mer. 9
  assert.equal(r.truncated, true);
});

test("travail pendant un jour off : hors moyennes, signalé à part", () => {
  const slots = [slot("bureau", "2026-09-21", "09:00", "10:00")];
  const r = computeReport({ slots, days: days({ "2026-09-21": "autre" }), start: "2026-09-21", end: "2026-09-21", today: "2026-09-30", now: 0 });
  assert.equal(r.baseDays, 0);
  assert.equal(r.avgPerDayMs, 0);
  assert.equal(r.offDayWorkMs, 1 * H);
});

test("éléments supprimés ignorés", () => {
  const s = { ...slot("bureau", "2026-09-21", "09:00", "10:00"), deleted: true };
  assert.equal(dayTotals([s], "2026-09-21", 0).bureau, 0);
});

test("compteur annuel des jours off", () => {
  const d = days({ "2026-01-05": "cp", "2026-03-02": "cp", "2026-05-11": "rtt", "2026-06-01": "travaillee", "2025-12-29": "cp" });
  assert.deepEqual(yearOffCount(d, 2026), { cp: 2, rtt: 1, autre: 0, total: 3 });
});

test("statistiques cigarettes", () => {
  const now = at("2026-09-27", "18:00"); // dimanche
  const cigs = [
    cig("2026-09-21", "10:10"), cig("2026-09-21", "10:40"), cig("2026-09-22", "15:00"),
    cig("2026-09-27", "10:20"), cig("2026-09-27", "12:00"),
  ];
  const s = cigaretteStats(cigs, now);
  assert.equal(s.today, 2);
  assert.equal(s.sinceLastMs, 6 * H);
  assert.equal(s.recordMs, at("2026-09-27", "10:20") - at("2026-09-22", "15:00"));
  assert.equal(s.avgWeek, 5 / 7);
  assert.deepEqual(s.last7.map((d) => d.count), [2, 1, 0, 0, 0, 0, 2]);
  assert.deepEqual(s.topHour, { hour: 10, count: 3 });
});
