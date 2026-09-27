// Petits outils d'interface : échappement, boîtes de dialogue, messages, partage.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Ouvre une boîte de dialogue. `actions` : [{ label, value, kind }].
 * Renvoie une promesse résolue avec la valeur du bouton choisi (ou null si fermée).
 * `onOpen(dialog)` permet de brancher des comportements sur le contenu.
 */
export function openDialog({ title, body, actions, onOpen }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "sheet";
    dlg.innerHTML = `
      <form method="dialog" class="sheet-inner">
        <h2 class="sheet-title">${esc(title)}</h2>
        <div class="sheet-body">${body}</div>
        <div class="sheet-actions">
          ${actions
            .map((a) => `<button class="btn ${a.kind ?? ""}" value="${esc(a.value)}" ${a.novalidate ? "formnovalidate" : ""}>${esc(a.label)}</button>`)
            .join("")}
        </div>
      </form>`;
    document.body.append(dlg);
    let result = null;
    dlg.querySelector("form").addEventListener("submit", (e) => {
      result = e.submitter?.value ?? null;
    });
    dlg.addEventListener("close", () => {
      dlg.remove();
      resolve(result);
    });
    onOpen?.(dlg);
    dlg.showModal();
  });
}

export async function confirmDialog(title, message, okLabel = "Confirmer", kind = "primary") {
  const r = await openDialog({
    title,
    body: `<p>${message}</p>`,
    actions: [
      { label: "Annuler", value: "cancel", kind: "ghost", novalidate: true },
      { label: okLabel, value: "ok", kind },
    ],
  });
  return r === "ok";
}

let toastTimer;
export function toast(msg) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---- Partage de fichiers -------------------------------------------------

export function makeFile(content, filename, type) {
  return new File([content], filename, { type });
}

export const canShareFiles = (file) => !!navigator.canShare?.({ files: [file] });

/** Menu de partage natif (iPhone). Renvoie true si partagé, false si annulé. */
export async function shareFile(file) {
  try {
    await navigator.share({ files: [file], title: file.name });
    return true;
  } catch (e) {
    if (e?.name === "AbortError") return false;
    throw e;
  }
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
