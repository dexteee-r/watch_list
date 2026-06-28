import { useMemo } from 'react'
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
            <div className="flex flex-wrap gap-2">
              {eps.map((ep) => {
                const watched = watchedSet.has(`${season}-${ep.number}`)
                return (
                  <motion.button
                    key={ep.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(season, ep.number, watched)}
                    whileTap={disabled ? undefined : tap}
                    title={`${ep.number}. ${ep.name ?? ''}`.trim()}
                    aria-pressed={watched}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      watched
                        ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
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
