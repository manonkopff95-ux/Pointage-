// Définitions partagées : catégories d'activité et types de journée.

export const CATEGORIES = {
  bureau: { label: "Bureau", color: "#4B2A6B", text: "#FFFFFF", work: true },
  rdv: { label: "Rendez-vous", color: "#A8327C", text: "#FFFFFF", work: true },
  voiture: { label: "Voiture", color: "#C9B6F2", text: "#2A1B3D", work: true },
  formation: { label: "Lire / se former", color: "#2E6F73", text: "#FFFFFF", work: true },
  pause: { label: "Pause", color: "#E4DAF5", text: "#2A1B3D", work: false },
};

export const WORK_CATEGORIES = ["bureau", "rdv", "voiture", "formation"];
export const ALL_CATEGORIES = [...WORK_CATEGORIES, "pause"];

export const DAY_TYPES = {
  travaillee: "Travaillée",
  cp: "CP",
  rtt: "RTT",
  autre: "Autre off",
};
export const OFF_TYPES = ["cp", "rtt", "autre"];

export const categoryLabel = (c) => CATEGORIES[c]?.label ?? c;
export const dayTypeLabel = (t) => DAY_TYPES[t] ?? DAY_TYPES.travaillee;

/** Type d'un jour : « travaillee » par défaut s'il n'a jamais été renseigné. */
export const dayTypeOf = (days, key) => {
  const d = days instanceof Map ? days.get(key) : days?.[key];
  return d && !d.deleted && d.type ? d.type : "travaillee";
};
