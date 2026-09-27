import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKey, parisToEpoch, formatHM, formatDuration, formatLongDate, weekRange, monthRange,
  previousMonthRange, isWeekday, formatDecimalHours, addDays,
} from "../js/time.js";

test("heure de Paris, été comme hiver, indépendamment du fuseau du système", () => {
  assert.equal(new Date(parisToEpoch("2026-07-01", 9, 0)).toISOString(), "2026-07-01T07:00:00.000Z");
  assert.equal(new Date(parisToEpoch("2026-01-15", 9, 0)).toISOString(), "2026-01-15T08:00:00.000Z");
  assert.equal(formatHM(Date.parse("2026-07-01T21:30:00Z")), "23:30");
  assert.equal(dateKey(Date.parse("2026-07-01T22:30:00Z")), "2026-07-02");
});

test("changement d'heure : le jour du passage à l'heure d'hiver dure 25 h", () => {
  const d = parisToEpoch("2026-10-26", 0, 0) - parisToEpoch("2026-10-25", 0, 0);
  assert.equal(d, 25 * 3600000);
});

test("formats français", () => {
  assert.equal(formatDuration(105 * 60000), "1 h 45");
  assert.equal(formatDuration(120 * 60000), "2 h");
  assert.equal(formatDuration(45 * 60000), "45 min");
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatLongDate("2026-09-01"), "mardi 1er septembre 2026");
  assert.equal(formatLongDate("2026-09-22"), "mardi 22 septembre 2026");
  assert.equal(formatDecimalHours(105 * 60000), "1,75");
});

test("périodes", () => {
  assert.deepEqual(weekRange("2026-09-27"), { start: "2026-09-21", end: "2026-09-27" });
  assert.deepEqual(weekRange("2026-09-21"), { start: "2026-09-21", end: "2026-09-27" });
  assert.deepEqual(monthRange("2026-02-10"), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(previousMonthRange("2026-01-10"), { start: "2025-12-01", end: "2025-12-31" });
  assert.equal(isWeekday("2026-09-26"), false);
  assert.equal(isWeekday("2026-09-25"), true);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
