// Sauvegarde complète (JSON) et réimportation.

import { all, list, getMeta, setMeta, replaceAll } from "../db.js";
import { buildBackup, parseBackup } from "../exporters.js";
import { dateKey, formatLongDate, formatHM } from "../time.js";
import { esc, $, toast, confirmDialog, makeFile, canShareFiles, shareFile, downloadFile } from "../ui.js";

const DAY = 86400000;

function counts(d) {
  const n = (arr) => arr.filter((r) => !r.deleted).length;
  return `${n(d.slots)} créneaux, ${n(d.days)} journées renseignées, ${n(d.cigarettes)} cigarettes`;
}

export function render(root) {
  const now = Date.now();
  const last = getMeta("lastBackupAt");
  const old = !last || now - last > 30 * DAY;

  root.innerHTML = `
    <header class="page-head"><h1>Sauvegarde</h1></header>
    <section class="card">
      <p>Vos données sont enregistrées uniquement sur ce téléphone. Une sauvegarde régulière évite de tout perdre
      (changement de téléphone, données de Safari effacées…).</p>
      <p class="${old ? "warn" : "ok"}">${last ? `Dernière sauvegarde : ${esc(formatLongDate(dateKey(last)))} à ${formatHM(last)}` : "Aucune sauvegarde pour l'instant."}
      ${last && old ? ` — il y a ${Math.floor((now - last) / DAY)} jours` : ""}</p>
      <p class="muted small">Contenu actuel : ${counts({ slots: list("slots"), days: list("days"), cigarettes: list("cigarettes") })}.</p>
      <button class="btn primary wide" id="export">Sauvegarder toutes mes données</button>
      <p class="muted small">Enregistrez le fichier dans « Fichiers » (iCloud Drive) ou envoyez-le-vous par e-mail.</p>
    </section>

    <section class="card">
      <h2 class="card-title">Restaurer une sauvegarde</h2>
      <p class="muted small">Remplace toutes les données actuelles par celles du fichier choisi.</p>
      <label class="btn outline wide file-btn">Choisir un fichier de sauvegarde…
        <input type="file" id="import" accept=".json,application/json" hidden>
      </label>
    </section>
  `;

  $("#export", root).addEventListener("click", async () => {
    const t = Date.now();
    const data = buildBackup({ slots: all("slots"), days: all("days"), cigs: all("cigarettes"), meta: { deviceId: getMeta("deviceId") }, now: t });
    const file = makeFile(JSON.stringify(data, null, 1), `pointage_sauvegarde_${dateKey(t)}.json`, "application/json");
    let done = false;
    if (canShareFiles(file)) {
      try {
        done = await shareFile(file);
      } catch {
        downloadFile(file);
        done = true;
      }
    } else {
      downloadFile(file);
      done = true;
    }
    if (done) {
      await setMeta("lastBackupAt", t);
      toast("Sauvegarde effectuée");
      render(root);
    }
  });

  $("#import", root).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    let data;
    try {
      data = parseBackup(await f.text());
    } catch (err) {
      toast(err.message);
      return;
    }
    const when = data.exportedAt ? ` du ${formatLongDate(dateKey(Date.parse(data.exportedAt)))}` : "";
    const ok = await confirmDialog(
      "Remplacer mes données ?",
      `La sauvegarde${esc(when)} contient ${counts(data)}.<br><br><strong>Toutes les données actuelles de ce téléphone
      (${counts({ slots: list("slots"), days: list("days"), cigarettes: list("cigarettes") })}) seront écrasées.</strong>`,
      "Écraser et restaurer",
      "danger"
    );
    if (!ok) return;
    await replaceAll(data);
    toast("Données restaurées");
    render(root);
  });
}
