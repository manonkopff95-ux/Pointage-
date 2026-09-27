// Point d'entrée : chargement des données, navigation, mise à jour en continu.

import { loadAll, save, getMeta } from "./db.js";
import { parseRoute, navigate } from "./router.js";
import { openSlot } from "./actions.js";
import { CATEGORIES } from "./model.js";
import { dateKey, addDays, parisToEpoch, formatHM, formatLongDate } from "./time.js";
import { esc, openDialog, toast } from "./ui.js";
import * as today from "./views/today.js";
import * as recap from "./views/recap.js";
import * as reports from "./views/reports.js";
import * as cigarettes from "./views/cigarettes.js";
import * as exporter from "./views/export.js";
import * as backup from "./views/backup.js";

const donnees = {
  render(root) {
    const last = getMeta("lastBackupAt");
    root.innerHTML = `
      <header class="page-head"><h1>Mes données</h1></header>
      <a class="card link-card" href="#/exporter"><strong>Exporter une période</strong>
        <span class="muted">Texte pour une IA ou tableur, sur les dates de votre choix</span></a>
      <a class="card link-card" href="#/sauvegarde"><strong>Sauvegarde</strong>
        <span class="muted">${last ? `Dernière le ${esc(formatLongDate(dateKey(last)))}` : "Aucune sauvegarde pour l'instant"}</span></a>
      <p class="muted small center">Vos données restent sur ce téléphone.</p>`;
  },
};

const VIEWS = { aujourdhui: today, recap, rapports: reports, cigarettes, exporter, sauvegarde: backup, donnees };
const TABS = [
  ["aujourdhui", "Aujourd'hui", "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"],
  ["recap", "Récap", "M8 6h11M8 12h11M8 18h11M4 6h.01M4 12h.01M4 18h.01"],
  ["rapports", "Rapports", "M5 20V10M12 20V4M19 20v-7"],
  ["cigarettes", "Cigarettes", "M3 15h14v3H3zM20 15v3M17 8c0-2 2-2 2-4M20 11c0-2 1-3 1-5"],
  ["donnees", "Données", "M12 3v12m0 0-4-4m4 4 4-4M5 21h14"],
];
const TAB_OF = { exporter: "donnees", sauvegarde: "donnees" };

const main = document.getElementById("view");
const tabbar = document.getElementById("tabbar");
let current = null;

function renderTabs(name) {
  const active = TAB_OF[name] ?? name;
  tabbar.innerHTML = TABS.map(
    ([k, label, d]) => `<a href="#/${k === "aujourdhui" ? "" : k}" class="${k === active ? "on" : ""}" ${k === active ? 'aria-current="page"' : ""}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${label}</span></a>`
  ).join("");
}

function route() {
  const { name, params } = parseRoute();
  current = VIEWS[name] ?? today;
  renderTabs(VIEWS[name] ? name : "aujourdhui");
  current.render(main, params);
  window.scrollTo(0, 0);
}

// ---- « Fin de journée » oubliée ----------------------------------------------

const dismissed = new Set();
let checking = false;

async function checkForgottenEnd() {
  const cur = openSlot();
  const now = Date.now();
  if (checking || !cur || dateKey(cur.start) >= dateKey(now) || dismissed.has(cur.id)) return;
  checking = true;
  const startKey = dateKey(cur.start);
  const cat = CATEGORIES[cur.category].label;
  let form;
  const r = await openDialog({
    title: "Fin de journée oubliée ?",
    body: `<p>L'activité <strong>${esc(cat)}</strong> est toujours en cours depuis le
      <strong>${esc(formatLongDate(startKey))} à ${formatHM(cur.start)}</strong>.</p>
      <label class="field"><span>À quelle heure avez-vous terminé ?</span><input type="time" name="end" required></label>
      <p class="muted small" id="fe-hint">Une heure plus tôt que ${formatHM(cur.start)} sera comprise comme le lendemain.</p>`,
    actions: [
      { label: "C'est toujours en cours", value: "keep", kind: "ghost", novalidate: true },
      { label: "Enregistrer la fin", value: "save", kind: "primary" },
    ],
    onOpen: (dlg) => (form = dlg.querySelector("form")),
  });
  checking = false;
  if (r !== "save") {
    dismissed.add(cur.id);
    return;
  }
  const [h, m] = form.elements.end.value.split(":").map(Number);
  let end = parisToEpoch(startKey, h, m);
  if (end <= cur.start) end = parisToEpoch(addDays(startKey, 1), h, m);
  end = Math.min(end, now);
  await save("slots", { id: cur.id, end });
  toast("Journée clôturée — vérifiez le récapitulatif");
  navigate(`#/recap/${startKey}`);
}

// ---- Démarrage -----------------------------------------------------------------

async function start() {
  try {
    await loadAll();
  } catch (e) {
    main.innerHTML = `<p class="empty">Impossible d'ouvrir le stockage local (${esc(e?.message ?? e)}).
      En navigation privée, Safari peut bloquer l'enregistrement.</p>`;
    return;
  }
  window.addEventListener("hashchange", route);
  route();
  checkForgottenEnd();
  setInterval(() => current?.tick?.(main), 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // Au retour dans l'appli, on redessine l'écran : les durées se recalculent
    // à partir des horodatages enregistrés.
    route();
    checkForgottenEnd();
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

start();
