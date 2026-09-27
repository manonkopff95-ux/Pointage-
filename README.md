# Pointage

Application web mobile (PWA) en français pour pointer son temps de travail,
suivre sa consommation de cigarettes et extraire ses données.

- HTML, CSS et JavaScript natifs, sans étape de compilation.
- Données stockées localement (IndexedDB), fonctionnement hors ligne (service worker).
- Fuseau horaire Europe/Paris, format 24 h.

Mise en ligne et installation sur iPhone : voir [GUIDE-GITHUB.md](GUIDE-GITHUB.md).

## Organisation du code

| Fichier | Rôle |
|---|---|
| `js/time.js` | Dates et heures à l'heure de Paris, formats français |
| `js/calc.js` | Règles de calcul (moyennes sur jours ouvrés, week-end, minuit, cigarettes) |
| `js/exporters.js` | Exports Markdown, CSV et sauvegarde JSON |
| `js/db.js` | Stockage IndexedDB (identifiants uniques, dates de modification, suppressions tracées : prêt pour une synchronisation) |
| `js/actions.js` | Actions : pointer, pause, fin de journée, cigarettes |
| `js/views/*.js` | Écrans |
| `tests/` | Tests (`npm test`, Node.js 20+) |

## Règles de calcul

- Moyennes sur les jours ouvrés (lundi–vendredi) de la période, jours off (CP, RTT,
  Autre) déduits ; un jour ouvré sans pointage compte pour zéro. Les jours à venir
  de la période en cours ne comptent pas.
- Samedi et dimanche : comptés à part en heures supplémentaires.
- Temps travaillé pendant un jour off : exclu des moyennes, signalé à part.
- Pauses jamais comptées comme travail.
- Un créneau qui franchit minuit est réparti sur les deux jours.
- Moyenne par semaine = moyenne par jour ouvré × 5.
