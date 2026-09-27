// Écran « Aujourd'hui » : pointage en un geste, note, encart cigarettes.

import { list, getMeta } from "../db.js";
import { CATEGORIES, WORK_CATEGORIES } from "../model.js";
import { dayTotals, workOf, cigaretteStats } from "../calc.js";
import { dateKey, formatHM, formatClock, formatDuration, formatLongDuration, formatDayMonth, capitalize } from "../time.js";
import { openSlot, pausedSince, startActivity, startPause, endDay, setNote, addCigarette, removeLastCigarette } from "../actions.js";
import { esc, $, $$, toast, confirmDialog } from "../ui.js";
import { navigate } from "../router.js";

const DAY = 86400000;

function backupReminder(now) {
  const last = getMeta("lastBackupAt");
  const ref = last ?? getMeta("firstUseAt") ?? now;
  const hasData = list("slots").length + list("cigarettes").length > 0;
  if (!hasData || now - ref < 30 * DAY) return "";
  const txt = last ? `Dernière sauvegarde il y a ${Math.floor((now - last) / DAY)} jours.` : "Aucune sauvegarde pour l'instant.";
  return `<a class="reminder" href="#/sauvegarde">${txt} <u>Sauvegarder</u></a>`;
}

export function render(root) {
  const now = Date.now();
  const today = dateKey(now);
  const cur = openSlot();
  const paused = pausedSince(now);
  const cat = cur ? CATEGORIES[cur.category] : null;
  const label = cur ? cat.label : paused ? "En pause" : "Aucune activité en cours";
  const since = cur ? cur.start : paused;

  root.innerHTML = `
    <header class="page-head">
      <h1>Aujourd'hui</h1>
      <p class="muted">${esc(capitalize(formatDayMonth(today)))}</p>
    </header>
    ${backupReminder(now)}

    <section class="current ${cur ? "" : paused ? "paused" : "idle"}" style="${cat ? `--c:${cat.color};--t:${cat.text}` : ""}">
      <div class="current-top">
        <span class="current-label">${esc(label)}</span>
        ${since ? `<span class="current-since">depuis ${formatHM(since)}</span>` : ""}
      </div>
      <div class="current-clock num" data-live="elapsed">${since ? formatClock(now - since) : "–:––:––"}</div>
      ${paused ? '<div class="current-note">Non comptabilisé</div>' : ""}
      <div class="current-worked">Travaillé depuis ce matin : <strong class="num" data-live="worked">–</strong></div>
    </section>

    <div class="grid4">
      ${WORK_CATEGORIES.map((c) => {
        const k = CATEGORIES[c];
        const active = cur?.category === c;
        return `<button class="act ${active ? "active" : ""}" data-cat="${c}" style="--c:${k.color};--t:${k.text}" aria-pressed="${active}">
          <span>${esc(k.label)}</span>${active ? '<small>en cours</small>' : ""}</button>`;
      }).join("")}
    </div>
    <div class="row2">
      <button class="btn pause ${paused ? "active" : ""}" id="pause" aria-pressed="${!!paused}" ${cur || paused ? "" : "disabled"}>Pause</button>
      <button class="btn outline" id="end-day" ${cur || paused ? "" : "disabled"}>Fin de journée</button>
    </div>

    <label class="field">
      <span>Note sur l'activité en cours <span class="muted">(facultatif)</span></span>
      <textarea id="note" rows="2" placeholder="${cur ? "Ce que je fais…" : "Démarrez une activité pour ajouter une note"}" ${cur ? "" : "disabled"}>${esc(cur?.note ?? "")}</textarea>
    </label>

    <section class="card cig">
      <div class="cig-info">
        <div><span class="cig-count num" data-live="cig-count">0</span> <span data-live="cig-word">cigarette</span> aujourd'hui</div>
        <div class="muted" data-live="cig-since"></div>
      </div>
      <div class="cig-btns">
        <button class="btn minus" id="cig-minus" aria-label="Retirer la dernière cigarette">−</button>
        <button class="btn cig-plus" id="cig-plus">+ 1 cigarette</button>
      </div>
    </section>

    <nav class="quick-links">
      <a href="#/recap">Récapitulatif</a>
      <a href="#/rapports">Rapports</a>
      <a href="#/cigarettes">Stats cigarettes</a>
      <a href="#/exporter">Exporter</a>
      <a href="#/sauvegarde">Sauvegarde</a>
    </nav>
  `;

  $$("[data-cat]", root).forEach((b) =>
    b.addEventListener("click", async () => {
      await startActivity(b.dataset.cat);
      navigator.vibrate?.(15);
      render(root);
    })
  );

  $("#pause", root).addEventListener("click", async () => {
    if (pausedSince()) return;
    await startPause();
    navigator.vibrate?.(15);
    render(root);
  });

  $("#end-day", root).addEventListener("click", async () => {
    const msg = openSlot() ? `Terminer l'activité en cours à ${formatHM(Date.now())} ?` : "Terminer la journée ?";
    const ok = await confirmDialog("Fin de journée", msg, "Terminer");
    if (!ok) return;
    const key = await endDay();
    navigate(`#/recap/${key}`);
  });

  let noteTimer;
  const note = $("#note", root);
  note.addEventListener("input", () => {
    clearTimeout(noteTimer);
    const id = cur.id;
    noteTimer = setTimeout(() => setNote(id, note.value), 400);
  });
  note.addEventListener("blur", () => {
    if (!cur) return;
    clearTimeout(noteTimer);
    setNote(cur.id, note.value);
  });

  $("#cig-plus", root).addEventListener("click", async () => {
    await addCigarette();
    navigator.vibrate?.(15);
    tick(root);
  });
  $("#cig-minus", root).addEventListener("click", async () => {
    if (await removeLastCigarette()) toast("Dernière cigarette retirée");
    else toast("Aucune cigarette aujourd'hui");
    tick(root);
  });

  tick(root);
}

/** Mise à jour chaque seconde, toujours recalculée à partir des horodatages. */
export function tick(root) {
  const now = Date.now();
  const cur = openSlot();
  const since = cur ? cur.start : pausedSince(now);
  const set = (k, v) => {
    const el = root.querySelector(`[data-live="${k}"]`);
    if (el && el.textContent !== v) el.textContent = v;
  };
  if (since) set("elapsed", formatClock(now - since));
  set("worked", formatDuration(workOf(dayTotals(list("slots"), dateKey(now), now))));
  const s = cigaretteStats(list("cigarettes"), now);
  set("cig-count", String(s.today));
  set("cig-word", s.today > 1 ? "cigarettes" : "cigarette");
  set("cig-since", s.last ? `Dernière il y a ${formatLongDuration(s.sinceLastMs)}` : "Aucune cigarette enregistrée");
}
