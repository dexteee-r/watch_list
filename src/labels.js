// UI layer: French labels for the domain statuses defined in api/store.js.
// Kept separate from STATUSES so the data layer stays language-agnostic.
export const STATUS_LABELS = {
  watching: 'En cours',
  completed: 'Terminé',
  dropped: 'Abandonné',
  plan_to_watch: 'À voir',
}

// Dark-theme badge styles (subtle tinted fills, one hue per status).
export const STATUS_BADGE_STYLES = {
  watching: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/20',
  completed: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20',
  dropped: 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/20',
  plan_to_watch: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20',
}
