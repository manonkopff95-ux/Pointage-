// Extraction des données sur une période : Markdown (pour une IA) ou CSV (tableur).

import { list, mem } from "../db.js";
import { buildMarkdown, buildCSV, exportFileName } from "../exporters.js";
import { dateKey, weekRange, monthRange, previousMonthRange, yearRange, formatLongDate } from "../time.js";
import { esc, $, $$, toast, makeFile, canShareFiles, shareFile, downloadFile, copyText } from "../ui.js";

let state = null;

export function render(root) {
  const today = dateKey(Date.now());
  const shortcuts = {
    semaine: ["Cette semaine", weekRange(today)],
    mois: ["Ce mois", monthRange(today)],
    precedent: ["Mois précédent", previousMonthRange(today)],
    annee: ["Cette année", yearRange(today)],
  };
  state ??= { ...monthRange(today) };

  root.innerHTML = `
    <header class="page-head"><h1>Exporter</h1><p class="muted">Extraire mes données sur une période</p></header>
    <section class="card">
      <div class="chips">
        ${Object.entries(shortcuts).map(([k, [l]]) => `<button class="chip-btn" data-short="${k}">${l}</button>`).join("")}
      </div>
      <div class="row2">
        <label class="field"><span>Du</span><input type="date" id="from" value="${state.start}" required></label>
        <label class="field"><span>Au</span><input type="date" id="to" value="${state.end}" required></label>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">Format</h2>
      <button class="btn primary wide format" data-format="md">
        <strong>Texte lisible (Markdown)</strong><small>À coller dans une IA : synthèse puis détail jour par jour</small>
      </button>
      <button class="btn outline wide format" data-format="csv">
        <strong>Tableur (CSV)</strong><small>Une ligne par créneau, pour Excel ou Numbers</small>
      </button>
    </section>
    <div id="result"></div>
  `;

  const from = $("#from", root), to = $("#to", root);
  const sync = () => {
    state = { start: from.value, end: to.value };
  };
  from.addEventListener("change", sync);
  to.addEventListener("change", sync);
  $$("[data-short]", root).forEach((b) =>
    b.addEventListener("click", () => {
      const r = shortcuts[b.dataset.short][1];
      from.value = r.start;
      to.value = r.end;
      sync();
    })
  );

  $$("[data-format]", root).forEach((b) =>
    b.addEventListener("click", () => {
      sync();
      if (!state.start || !state.end) return toast("Choisissez les deux dates");
      if (state.start > state.end) return toast("La date de début est après la date de fin");
      const now = Date.now();
      const args = { slots: list("slots"), days: mem.days, cigs: list("cigarettes"), start: state.start, end: state.end, today: dateKey(now), now };
      const md = b.dataset.format === "md";
      const content = md ? buildMarkdown(args) : buildCSV(args);
      const file = makeFile(content, exportFileName(state.start, state.end, md ? "md" : "csv"), md ? "text/plain" : "text/csv");
      showResult($("#result", root), file, content, md);
    })
  );
}

function showResult(el, file, content, md) {
  const share = canShareFiles(file);
  const preview = content.replace(/^﻿/, "").split(/\r?\n/).slice(0, 30).join("\n");
  el.innerHTML = `
    <section class="card result">
      <h2 class="card-title">${esc(file.name)}</h2>
      <p class="muted small">Du ${esc(formatLongDate(state.start))} au ${esc(formatLongDate(state.end))}</p>
      <div class="result-btns">
        ${share ? '<button class="btn primary" id="r-share">Partager…</button>' : ""}
        <button class="btn outline" id="r-dl">Télécharger</button>
        <button class="btn outline" id="r-copy">Copier</button>
      </div>
      <details><summary>Aperçu</summary><pre class="preview">${esc(preview)}${content.split("\n").length > 30 ? "\n…" : ""}</pre></details>
    </section>`;
  $("#r-share", el)?.addEventListener("click", async () => {
    try {
      await shareFile(file);
    } catch {
      toast("Partage impossible, essayez « Télécharger »");
    }
  });
  $("#r-dl", el).addEventListener("click", () => downloadFile(file));
  $("#r-copy", el).addEventListener("click", async () => {
    toast((await copyText(content.replace(/^﻿/, ""))) ? (md ? "Texte copié : collez-le dans votre IA" : "Copié dans le presse-papiers") : "Copie impossible");
  });
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
