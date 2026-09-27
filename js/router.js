// Navigation par l'ancre de l'adresse (#/recap/2026-09-22…).

export function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { name: parts[0] || "aujourdhui", params: parts.slice(1) };
}

export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}
