// Statistiques cigarettes.

import { list } from "../db.js";
import { cigaretteStats } from "../calc.js";
import { formatLongDuration, formatClock, formatNumber, formatWeekdayShort, formatDayMonth, formatHM } from "../time.js";
import { addCigarette, removeLastCigarette } from "../actions.js";
import { esc, $, toast } from "../ui.js";

// Chronomètre à la seconde sous 24 h, puis en jours.
const since = (ms) => (ms < 86400000 ? formatClock(ms) : formatLongDuration(ms));

export function render(root) {
  const now = Date.now();
  const s = cigaretteStats(list("cigarettes"), now);
  const max = Math.max(1, ...s.last7.map((d) => d.count));
  const h = s.topHour ? `${s.topHour.hour} h – ${(s.topHour.hour + 1) % 24} h` : "–";

  root.innerHTML = `
    <header class="page-head"><h1>Cigarettes</h1></header>
    <section class="card hero cig-hero">
      <p class="hero-label">Depuis la dernière cigarette</p>
      <p class="hero-value num" data-live="since">${s.last ? since(s.sinceLastMs) : "–"}</p>
      <p class="muted" data-live="last">${s.last ? `Dernière à ${formatHM(s.last)}` : "Aucune cigarette enregistrée"}</p>
      <p class="hero-sub">Record sans fumer : <strong class="num" data-live="record">${formatLongDuration(s.recordMs)}</strong>
        <span data-live="ongoing">${s.recordOngoing && s.recordMs >= 60000 ? " — c'est maintenant !" : ""}</span></p>
    </section>

    <div class="cig-btns wide">
      <button class="btn minus" id="cig-minus" aria-label="Retirer la dernière cigarette">−</button>
      <button class="btn cig-plus" id="cig-plus">+ 1 cigarette</button>
    </div>

    <div class="stats3">
      <div class="card stat"><p class="num big2">${s.today}</p><p class="muted small">aujourd'hui</p></div>
      <div class="card stat"><p class="num big2">${formatNumber(s.avgWeek)}</p><p class="muted small">par jour cette semaine</p></div>
      <div class="card stat"><p class="num big2">${formatNumber(s.avgMonth)}</p><p class="muted small">par jour ce mois-ci</p></div>
    </div>

    <section class="card">
      <h2 class="card-title">Sept derniers jours</h2>
      <div class="histo" role="img" aria-label="${esc(s.last7.map((d) => `${formatDayMonth(d.key)} : ${d.count}`).join(", "))}">
        ${s.last7.map((d, i) => `
          <div class="histo-col ${i === 6 ? "today" : ""}" title="${esc(formatDayMonth(d.key))} : ${d.count}">
            <span class="histo-val num">${d.count}</span>
            <span class="histo-bar" style="height:${(d.count / max) * 100}%"></span>
            <span class="histo-day">${esc(i === 6 ? "auj." : formatWeekdayShort(d.key))}</span>
          </div>`).join("")}
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">Tranche horaire la plus fréquente</h2>
      <p class="num big2">${h}</p>
      <p class="muted small">${s.topHour ? `${s.topHour.count} cigarette${s.topHour.count > 1 ? "s" : ""} dans cette tranche sur les 30 derniers jours` : "Pas encore assez de données."}</p>
    </section>
  `;

  $("#cig-plus", root).addEventListener("click", async () => {
    await addCigarette();
    navigator.vibrate?.(15);
    render(root);
  });
  $("#cig-minus", root).addEventListener("click", async () => {
    toast((await removeLastCigarette()) ? "Dernière cigarette retirée" : "Aucune cigarette aujourd'hui");
    render(root);
  });
}

export function tick(root) {
  const s = cigaretteStats(list("cigarettes"), Date.now());
  if (!s.last) return;
  const set = (k, v) => {
    const el = root.querySelector(`[data-live="${k}"]`);
    if (el && el.textContent !== v) el.textContent = v;
  };
  set("since", since(s.sinceLastMs));
  set("record", formatLongDuration(s.recordMs));
  set("ongoing", s.recordOngoing && s.recordMs >= 60000 ? " — c'est maintenant !" : "");
}
