// Rapports Semaine / Mois / Année.

import { list, mem } from "../db.js";
import { CATEGORIES, WORK_CATEGORIES } from "../model.js";
import { computeReport, baseSentence, yearOffCount } from "../calc.js";
import {
  dateKey, addDays, weekRange, monthRange, yearRange, formatDuration, formatDayMonth, formatMonth, formatLongDate,
} from "../time.js";
import { esc } from "../ui.js";

const TABS = { semaine: "Semaine", mois: "Mois", annee: "Année" };

function periodFor(kind, today, offset) {
  if (kind === "semaine") {
    const r = weekRange(addDays(today, offset * 7));
    return { ...r, label: `Du ${formatDayMonth(r.start)} au ${formatDayMonth(r.end)}` };
  }
  if (kind === "mois") {
    const [y, m] = today.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    const r = monthRange(d.toISOString().slice(0, 10));
    const label = formatMonth(r.start);
    return { ...r, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }
  const y = Number(today.slice(0, 4)) + offset;
  return { ...yearRange(`${y}-01-01`), label: `Année ${y}` };
}

export function render(root, params) {
  const kind = TABS[params[0]] ? params[0] : "semaine";
  const offset = Math.min(0, parseInt(params[1] ?? "0", 10) || 0);
  const now = Date.now();
  const today = dateKey(now);
  const p = periodFor(kind, today, offset);
  const r = computeReport({ slots: list("slots"), days: mem.days, start: p.start, end: p.end, today, now });
  const year = Number(p.start.slice(0, 4));
  const off = yearOffCount(mem.days, year);

  root.innerHTML = `
    <header class="page-head"><h1>Rapports</h1></header>
    <div class="segmented tabs" role="tablist">
      ${Object.entries(TABS).map(([k, l]) => `<a role="tab" aria-selected="${k === kind}" class="${k === kind ? "on" : ""}" href="#/rapports/${k}">${l}</a>`).join("")}
    </div>
    <div class="date-nav">
      <a class="icon-btn" href="#/rapports/${kind}/${offset - 1}" aria-label="Période précédente">‹</a>
      <strong>${esc(p.label)}</strong>
      <a class="icon-btn ${offset >= 0 ? "disabled" : ""}" href="#/rapports/${kind}/${offset + 1}" aria-label="Période suivante">›</a>
    </div>

    ${r.empty ? '<p class="empty">Cette période n\'a pas encore commencé.</p>' : `
    <section class="card hero">
      <p class="hero-label">Moyenne par jour ouvré</p>
      <p class="hero-value num">${formatDuration(r.avgPerDayMs)}</p>
      <p class="muted">${esc(baseSentence(r))}${r.truncated ? `, jusqu'au ${esc(formatDayMonth(r.effectiveEnd))}` : ""}.</p>
      ${kind !== "semaine" ? `<p class="hero-sub">Moyenne par semaine : <strong class="num">${formatDuration(r.avgPerWeekMs)}</strong> <span class="muted small">(5 jours ouvrés)</span></p>` : ""}
      <p class="hero-sub">Total sur les jours ouvrés : <strong class="num">${formatDuration(r.baseWorkMs)}</strong></p>
    </section>

    <section class="card extra">
      <p>Heures supplémentaires (week-end)</p>
      <p class="num big2">${formatDuration(r.weekendMs)}</p>
      ${r.offDayWorkMs > 0 ? `<p class="muted small">+ ${formatDuration(r.offDayWorkMs)} travaillées pendant des jours off (hors moyennes).</p>` : ""}
    </section>

    <section class="card">
      <h2 class="card-title">Par catégorie</h2>
      <div class="stackbar" aria-hidden="true">
        ${WORK_CATEGORIES.filter((c) => r.categories[c].pct > 0).map((c) => `<span style="flex:${r.categories[c].pct};--c:${CATEGORIES[c].color}"></span>`).join("")}
      </div>
      <table class="cat-table">
        <thead><tr><th>Catégorie</th><th>Moy./jour</th><th>Total</th><th>%</th></tr></thead>
        <tbody>
        ${WORK_CATEGORIES.map((c) => {
          const x = r.categories[c];
          return `<tr><td><span class="dot" style="--c:${CATEGORIES[c].color}"></span>${esc(CATEGORIES[c].label)}</td>
            <td class="num">${formatDuration(x.avgPerDayMs)}</td><td class="num">${formatDuration(x.totalMs)}</td><td class="num">${Math.round(x.pct)} %</td></tr>`;
        }).join("")}
        </tbody>
      </table>
      <p class="muted small">Jours ouvrés hors jours off. Les pauses sont du temps vide, jamais comptées.</p>
    </section>`}

    <section class="card">
      <h2 class="card-title">Jours off ${year}</h2>
      <p class="off-count"><strong class="num big2">${off.total}</strong> ${off.total > 1 ? "jours" : "jour"}</p>
      <ul class="off-list">
        <li>CP <strong class="num">${off.cp}</strong></li>
        <li>RTT <strong class="num">${off.rtt}</strong></li>
        <li>Autre <strong class="num">${off.autre}</strong></li>
      </ul>
    </section>
    <p class="muted small center">Période du ${esc(formatLongDate(p.start))} au ${esc(formatLongDate(p.end))}.</p>
  `;
}
