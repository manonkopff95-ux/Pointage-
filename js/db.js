// Stockage local (IndexedDB). Toutes les données sont chargées en mémoire au
// démarrage (elles sont petites) puis chaque modification est écrite aussitôt.
//
// Pensé pour une future synchronisation en ligne : chaque enregistrement a un
// identifiant unique, une date de création et de dernière modification, et une
// suppression laisse une trace (« deleted: true ») au lieu d'effacer.

const DB_NAME = "pointage";
const DB_VERSION = 1;
export const STORES = ["slots", "days", "cigarettes", "meta"];

export const mem = { slots: new Map(), days: new Map(), cigarettes: new Map(), meta: new Map() };
let db = null;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

export async function loadAll() {
  db = await open();
  const tx = db.transaction(STORES, "readonly");
  for (const s of STORES) {
    const rows = await req(tx.objectStore(s).getAll());
    mem[s] = new Map(rows.map((r) => [r.id, r]));
  }
  if (!getMeta("deviceId")) await setMeta("deviceId", uuid());
  if (!getMeta("firstUseAt")) await setMeta("firstUseAt", Date.now());
  navigator.storage?.persist?.().catch(() => {});
}

async function write(store, record) {
  mem[store].set(record.id, record);
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(record);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return record;
}

/** Crée ou modifie un enregistrement (champs fusionnés). */
export function save(store, fields) {
  const now = Date.now();
  const prev = fields.id ? mem[store].get(fields.id) : null;
  const record = {
    ...prev,
    ...fields,
    id: fields.id ?? uuid(),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    deleted: false,
  };
  return write(store, record);
}

/** Suppression « douce » : l'enregistrement est marqué supprimé. */
export function remove(store, id) {
  const prev = mem[store].get(id);
  if (!prev) return Promise.resolve();
  return write(store, { ...prev, deleted: true, updatedAt: Date.now() });
}

export const list = (store) => [...mem[store].values()].filter((r) => !r.deleted);
export const all = (store) => [...mem[store].values()];
export const getMeta = (key) => mem.meta.get(key)?.value;
export const setMeta = (key, value) => write("meta", { id: key, value, updatedAt: Date.now() });

/** Remplace toutes les données (réimportation d'une sauvegarde). */
export async function replaceAll({ slots, days, cigarettes }) {
  const tx = db.transaction(["slots", "days", "cigarettes"], "readwrite");
  const data = { slots, days, cigarettes };
  for (const s of Object.keys(data)) {
    const os = tx.objectStore(s);
    os.clear();
    for (const r of data[s]) os.put(r);
    mem[s] = new Map(data[s].map((r) => [r.id, r]));
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
