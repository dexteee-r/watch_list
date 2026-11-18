import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { tap } from '../motion.js'

const RATING_VALUES = Array.from({ length: 10 }, (_, i) => i + 1)

function SeasonRating({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        aria-label="Note de la saison (sur 10)"
        className={`cursor-pointer appearance-none rounded-md border py-1 pl-2.5 pr-7 text-xs font-medium tabular-nums outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 ${
          value ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-zinc-700 bg-zinc-900/80 text-zinc-400'
        }`}
      >
        <option value="">Noter</option>
        {RATING_VALUES.map((n) => (
          <option key={n} value={n} className="bg-zinc-900 text-zinc-100">
            {n}/10
          </option>
        ))}
      </select>
    </div>
  )
}

export default function EpisodeGrid({
  episodes,
  watchedSet,
  onToggle,
  onToggleSeason,
  disabled = false,
  ratings = {},
  onRate,
}) {
  // Group episodes by season (sorted).
  const seasons = useMemo(() => {
    const map = new Map()
    for (const ep of episodes) {
      if (!map.has(ep.season)) map.set(ep.season, [])
      map.get(ep.season).push(ep)
    }
    return [...map.entries()]
      .map(([season, eps]) => [season, eps.sort((a, b) => a.number - b.number)])
      .sort((a, b) => a[0] - b[0])
  }, [episodes])

  // Glisser-cocher : maintenir le clic sur un épisode puis survoler les autres pour
  // les cocher (ou décocher) d'un coup. L'état appliqué est l'inverse de celui de
  // l'épisode de départ. La sélection = de l'épisode de départ à l'épisode survolé,
  // dans la même saison, en ordre de lecture (robuste si la souris saute une case).
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const suppressClick = useRef(false)

  const updateDrag = useCallback((next) => {
    dragRef.current = next
    setDrag(next)
  }, [])

  useEffect(() => {
    async function finishDrag() {
      const d = dragRef.current
      if (!d || d.committing) return
      if (d.start === d.end) {
        // Un seul épisode : c'est un simple clic, onClick s'en charge.
        updateDrag(null)
        return
      }
      // Le « click » qui suit le relâchement ne doit pas re-basculer l'épisode de
      // départ. Il part juste après le mouseup, donc on réarme au tour suivant.
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
      // On garde l'aperçu affiché jusqu'à la fin des requêtes (envoyées une par une).
      updateDrag({ ...d, committing: true })
      const lo = Math.min(d.start, d.end)
      const hi = Math.max(d.start, d.end)
      try {
        await onToggleSeason(d.season, d.eps.slice(lo, hi + 1), d.target)
      } catch {
        // Le parent resynchronise l'affichage dans son `finally`.
      } finally {
        updateDrag(null)
      }
    }
    function cancelDrag() {
      if (dragRef.current && !dragRef.current.committing) updateDrag(null)
    }
    window.addEventListener('mouseup', finishDrag)
    window.addEventListener('blur', cancelDrag)
    return () => {
      window.removeEventListener('mouseup', finishDrag)
      window.removeEventListener('blur', cancelDrag)
    }
  }, [onToggleSeason, updateDrag])

  function startDrag(e, season, eps, index, watched) {
    if (e.button !== 0 || disabled || !onToggleSeason || dragRef.current?.committing) return
    updateDrag({ season, eps, start: index, end: index, target: !watched, committing: false })
  }

  function extendDrag(season, index) {
    const d = dragRef.current
    if (!d || d.committing || d.season !== season || d.end === index) return
    updateDrag({ ...d, end: index })
  }

  if (episodes.length === 0) {
    return <p className="text-zinc-500">Aucun épisode trouvé.</p>
  }

  return (
    <div className="space-y-8">
      {seasons.map(([season, eps]) => {
        const watchedCount = eps.filter((e) => watchedSet.has(`${season}-${e.number}`)).length
        const allWatched = watchedCount === eps.length
        return (
          <div key={season}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-2">
              <h3 className="font-semibold text-zinc-200">Saison {season}</h3>
              <div className="flex items-center gap-3">
                {!disabled && onToggleSeason && (
                  <button
                    type="button"
                    onClick={() => onToggleSeason(season, eps, !allWatched)}
                    className="rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                  >
                    {allWatched ? 'Pas tout vu' : 'Tout vu'}
                  </button>
                )}
                {!disabled && onRate && (
                  <SeasonRating
                    value={ratings[season] ?? null}
                    onChange={(v) => onRate(season, v)}
                  />
                )}
                <span
                  className={`text-sm tabular-nums ${allWatched ? 'text-amber-400' : 'text-zinc-500'}`}
                >
                  {watchedCount}/{eps.length}
                </span>
              </div>
            </div>
            <div className="flex select-none flex-wrap gap-2">
              {eps.map((ep, index) => {
                const watched = watchedSet.has(`${season}-${ep.number}`)
                // Aperçu du glisser-cocher : les cases de la sélection s'affichent
                // déjà dans l'état qu'elles vont prendre.
                const inDrag =
                  drag !== null &&
                  drag.season === season &&
                  index >= Math.min(drag.start, drag.end) &&
                  index <= Math.max(drag.start, drag.end)
                const shown = inDrag ? drag.target : watched
                return (
                  <motion.button
                    key={ep.id}
                    type="button"
                    disabled={disabled}
                    onMouseDown={(e) => startDrag(e, season, eps, index, watched)}
                    onMouseEnter={() => extendDrag(season, index)}
                    onClick={() => {
                      if (suppressClick.current) return
                      onToggle(season, ep.number, watched)
                    }}
                    whileTap={disabled ? undefined : tap}
                    title={`${ep.number}. ${ep.name ?? ''}`.trim()}
                    aria-pressed={watched}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      shown
                        ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    } ${inDrag ? 'ring-2 ring-amber-200/60' : ''}`}
                  >
                    {ep.number}
                  </motion.button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
