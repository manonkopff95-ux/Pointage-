// Récapitulatif d'une journée : créneaux modifiables, type de journée, validation.

import { list, save, remove, mem } from "../db.js";
import { CATEGORIES, ALL_CATEGORIES, WORK_CATEGORIES, DAY_TYPES, dayTypeOf } from "../model.js";
import { daySegments, dayTotals, workOf } from "../calc.js";
import {
  dateKey, addDays, parisToEpoch, formatHM, formatDuration, formatLongDate, formatDayMonth, capitalize, isWeekday,
} from "../time.js";
import { getDay, setDayType, validateDay, openSlot } from "../actions.js";
import { esc, $, $$, openDialog, confirmDialog, toast } from "../ui.js";
import { navigate } from "../router.js";

const isKey = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");

export function render(root, params) {
  const now = Date.now();
  const today = dateKey(now);
  const key = isKey(params[0]) ? params[0] : today;
  const slots = list("slots");
  const segs = daySegments(slots, key, now);
  const totals = dayTotals(slots, key, now);
  const type = dayTypeOf(mem.days, key);
  const day = getDay(key);

  root.innerHTML = `
    <header class="page-head">
      <h1>Récapitulatif</h1>
      <div class="date-nav">
        <a class="icon-btn" href="#/recap/${addDays(key, -1)}" aria-label="Jour précédent">‹</a>
        <strong>${esc(capitalize(key === today ? "aujourd'hui, " + formatDayMonth(key) : formatLongDate(key)))}</strong>
        <a class="icon-btn ${key >= today ? "disabled" : ""}" href="#/recap/${addDays(key, 1)}" aria-label="Jour suivant">›</a>
      </div>
    </header>

    <section class="card">
      <h2 class="card-title">Type de journée</h2>
      <div class="segmented" role="radiogroup">
        ${Object.entries(DAY_TYPES).map(([t, label]) =>
          `<button role="radio" aria-checked="${t === type}" class="${t === type ? "on" : ""}" data-type="${t}">${esc(label)}</button>`
        ).join("")}
      </div>
      ${!isWeekday(key) ? '<p class="muted small">Week-end : le temps travaillé compte en heures supplémentaires.</p>' : ""}
    </section>

    <section>
      <h2 class="section-title">Créneaux</h2>
      ${segs.length === 0 ? '<p class="empty">Aucun créneau ce jour-là.</p>' : ""}
      <ul class="slots">
        ${segs.map((seg) => {
          const c = CATEGORIES[seg.slot.category];
          const flags = [
            seg.continuesFromPreviousDay ? `commencé la veille à ${formatHM(seg.slot.start)}` : "",
            seg.continuesNextDay ? "se poursuit le lendemain" : "",
            seg.running ? "en cours" : "",
          ].filter(Boolean).join(" · ");
          return `<li>
            <button class="slot" data-id="${seg.slot.id}" style="--c:${c.color};--t:${c.text}">
              <span class="slot-time num">${formatHM(seg.start)}–${seg.running && !seg.continuesNextDay ? "…" : formatHM(seg.end)}</span>
              <span class="slot-main">
                <span class="chip">${esc(c.label)}</span>
                <span class="slot-dur num">${formatDuration(seg.ms)}</span>
              </span>
              ${seg.slot.note ? `<span class="slot-note">${esc(seg.slot.note)}</span>` : ""}
              ${flags ? `<span class="slot-flag">${esc(flags)}</span>` : ""}
            </button>
          </li>`;
        }).join("")}
      </ul>
      <button class="btn outline wide" id="add-slot">+ Ajouter un créneau oublié</button>
    </section>

    <section class="card">
      <h2 class="card-title">Totaux du jour</h2>
      <ul class="totals">
        ${ALL_CATEGORIES.filter((c) => totals[c] > 0 || WORK_CATEGORIES.includes(c)).map((c) =>
          `<li><span class="dot" style="--c:${CATEGORIES[c].color}"></span>${esc(CATEGORIES[c].label)}<span class="num">${formatDuration(totals[c])}</span></li>`
        ).join("")}
        <li class="total-line">Temps travaillé<span class="num">${formatDuration(workOf(totals))}</span></li>
      </ul>
    </section>

    ${day?.validated ? `<p class="validated">✓ Journée validée</p>` : ""}
    <button class="btn primary wide" id="validate">${day?.validated ? "Valider à nouveau" : "Valider la journée"}</button>
  `;

  $$("[data-type]", root).forEach((b) =>
    b.addEventListener("click", async () => {
      await setDayType(key, b.dataset.type);
      render(root, [key]);
    })
  );
  $$(".slot", root).forEach((b) =>
    b.addEventListener("click", async () => {
      if (await editSlot(mem.slots.get(b.dataset.id), key)) render(root, [key]);
    })
  );
  $("#add-slot", root).addEventListener("click", async () => {
    if (await editSlot(null, key)) render(root, [key]);
  });
  $("#validate", root).addEventListener("click", async () => {
    if (openSlot() && dateKey(openSlot().start) <= key) {
      const ok = await confirmDialog("Activité en cours", "Une activité est encore en cours. Valider quand même ?", "Valider");
      if (!ok) return;
    }
    await validateDay(key);
    toast("Journée validée");
    navigate("#/");
  });
}

const toMin = (hm) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

/** Boîte d'édition d'un créneau (ou de création si slot est null). */
async function editSlot(slot, dayKey) {
  const startKey = slot ? dateKey(slot.start) : dayKey;
  const cat0 = slot?.category ?? "bureau";
  const running = slot && slot.end == null;
  const body = `
    <fieldset class="cat-pick">
      <legend>Catégorie</legend>
      ${ALL_CATEGORIES.map((c) => `<label class="cat-opt" style="--c:${CATEGORIES[c].color};--t:${CATEGORIES[c].text}">
        <input type="radio" name="cat" value="${c}" ${c === cat0 ? "checked" : ""}><span>${esc(CATEGORIES[c].label)}</span></label>`).join("")}
    </fieldset>
    <p class="muted small">Début le ${esc(formatDayMonth(startKey))}</p>
    <div class="row2">
      <label class="field"><span>Début</span><input type="time" name="start" required value="${slot ? formatHM(slot.start) : ""}"></label>
      <label class="field"><span>Fin</span><input type="time" name="end" ${running ? "" : "required"} value="${slot?.end != null ? formatHM(slot.end) : ""}"></label>
    </div>
    <p class="muted small" id="end-hint">${running ? "Laisser la fin vide : l'activité reste en cours." : ""}</p>
    <label class="field"><span>Note</span><textarea name="note" rows="3">${esc(slot?.note ?? "")}</textarea></label>
  `;
  let form;
  const actions = [
    { label: "Annuler", value: "cancel", kind: "ghost", novalidate: true },
    { label: "Enregistrer", value: "save", kind: "primary" },
  ];
  if (slot) actions.unshift({ label: "Supprimer", value: "delete", kind: "danger", novalidate: true });

  const r = await openDialog({
    title: slot ? "Modifier le créneau" : "Ajouter un créneau",
    body,
    actions,
    onOpen: (dlg) => {
      form = dlg.querySelector("form");
      const hint = dlg.querySelector("#end-hint");
      const upd = () => {
        const s = form.elements.start.value, e = form.elements.end.value;
        if (s && e && toMin(e) <= toMin(s)) hint.textContent = `Fin le lendemain (${formatDayMonth(addDays(startKey, 1))}) : le créneau franchit minuit.`;
        else if (!e && running) hint.textContent = "Laisser la fin vide : l'activité reste en cours.";
        else hint.textContent = "";
      };
      form.addEventListener("input", upd);
      upd();
    },
  });

  if (r === "delete") {
    if (!(await confirmDialog("Supprimer", "Supprimer ce créneau ?", "Supprimer", "danger"))) return false;
    await remove("slots", slot.id);
    toast("Créneau supprimé");
    return true;
  }
  if (r !== "save") return false;

  const [sh, sm] = form.elements.start.value.split(":").map(Number);
  const start = parisToEpoch(startKey, sh, sm);
  let end = null;
  if (form.elements.end.value) {
    const [eh, em] = form.elements.end.value.split(":").map(Number);
    const endKey = toMin(form.elements.end.value) <= toMin(form.elements.start.value) ? addDays(startKey, 1) : startKey;
    end = parisToEpoch(endKey, eh, em);
  }
  if (end == null && !running) return false;
  if (end == null && start > Date.now()) {
    toast("Le début est dans le futur");
    return false;
  }
  await save("slots", { id: slot?.id, category: form.elements.cat.value, start, end, note: form.elements.note.value.trim() });
  toast("Créneau enregistré");
  return true;
}
