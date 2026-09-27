import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarkdown, buildCSV, csvField, buildBackup, parseBackup } from "../js/exporters.js";
import { at, slot, cig, days } from "./helpers.js";

const base = () => ({
  slots: [
    slot("bureau", "2026-09-21", "09:00", "10:45", { note: "Dossier Martin; relecture" }),
    slot("pause", "2026-09-21", "10:45", "11:00"),
    slot("rdv", "2026-09-21", "11:00", "12:30", { note: 'Client "A"' }),
    slot("voiture", "2026-09-24", "23:00", "01:00", { endKey: "2026-09-25" }),
    slot("bureau", "2026-09-26", "10:00", "11:00"),
  ],
  days: days({ "2026-09-23": "rtt" }),
  cigs: [cig("2026-09-21", "10:00"), cig("2026-09-22", "10:00")],
  start: "2026-09-21",
  end: "2026-09-27",
  today: "2026-09-30",
  now: at("2026-09-30", "12:00"),
});

test("Markdown : en-tête de synthèse", () => {
  const md = buildMarkdown(base());
  assert.match(md, /^# Pointage du lundi 21 septembre 2026 au dimanche 27 septembre 2026/);
  assert.match(md, /Base de calcul : 5 jours ouvrés, dont 1 off, soit 4 jours/);
  // Travail en semaine : 1 h 45 + 1 h 30 + 1 h (jeudi) + 1 h (vendredi) = 5 h 15 → 1 h 19 par jour
  assert.match(md, /Temps travaillé sur les jours ouvrés : 5 h 15/);
  assert.match(md, /\*\*Moyenne par jour ouvré : 1 h 19\*\*/);
  assert.match(md, /Heures supplémentaires \(week-end\) : 1 h/);
  assert.match(md, /Jours off : 1 \(CP : 0, RTT : 1, Autre : 0\)/);
  assert.match(md, /Cigarettes : 2 au total/);
  assert.match(md, /\| Bureau \| 1 h 45 \| 26 min \| 33 % \|/);
});

test("Markdown : détail jour par jour au format demandé", () => {
  const md = buildMarkdown(base());
  assert.match(md, /### Lundi 21 septembre 2026 — Travaillée/);
  assert.ok(md.includes("- 09:00–10:45 · Bureau · 1 h 45 · Dossier Martin; relecture"));
  assert.ok(!md.includes("Pause"), "les pauses (temps vide) n'apparaissent pas");
  assert.match(md, /### Mercredi 23 septembre 2026 — RTT\n\n- Aucun pointage/);
  assert.ok(md.includes("- 23:00–00:00 · Voiture · 1 h (se poursuit le lendemain)"));
  assert.ok(md.includes("- 00:00–01:00 · Voiture · 1 h (suite de la veille)"));
  assert.match(md, /### Samedi 26 septembre 2026 — Week-end/);
  assert.ok(!md.includes("Dimanche 27 septembre"), "dimanche vide omis");
});

test("CSV : BOM UTF-8, point-virgule, une ligne par créneau", () => {
  const csv = buildCSV(base());
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).trimEnd().split("\r\n");
  assert.equal(lines[0], "Date;Jour;Type de journée;Catégorie;Début;Fin;Durée (min);Durée (h);Note");
  assert.equal(lines[1], '21/09/2026;lundi;Travaillée;Bureau;09:00;10:45;105;1,75;"Dossier Martin; relecture"');
  assert.equal(lines[2], '21/09/2026;lundi;Travaillée;Rendez-vous;11:00;12:30;90;1,50;"Client ""A"""');
  assert.equal(lines[3], "23/09/2026;mercredi;RTT;;;;0;0,00;");
  assert.equal(lines[4], "24/09/2026;jeudi;Travaillée;Voiture;23:00;00:00;60;1,00;(se poursuit le lendemain)");
  assert.equal(lines[5], "25/09/2026;vendredi;Travaillée;Voiture;00:00;01:00;60;1,00;(suite de la veille)");
  assert.equal(lines[6], "26/09/2026;samedi;Week-end;Bureau;10:00;11:00;60;1,00;");
  assert.equal(lines.length, 7);
});

test("CSV : échappement des champs", () => {
  assert.equal(csvField("a;b"), '"a;b"');
  assert.equal(csvField("ligne\nsuivante"), '"ligne\nsuivante"');
  assert.equal(csvField("simple"), "simple");
});

test("sauvegarde JSON : aller-retour et refus des fichiers invalides", () => {
  const b = base();
  const json = JSON.stringify(buildBackup({ slots: b.slots, days: [...b.days.values()], cigs: b.cigs, meta: { deviceId: "x" }, now: b.now }));
  const back = parseBackup(json);
  assert.equal(back.slots.length, 5);
  assert.equal(back.cigarettes.length, 2);
  assert.throws(() => parseBackup("pas du json"), /JSON illisible/);
  assert.throws(() => parseBackup('{"app":"autre","data":{}}'), /ne provient pas/);
});
