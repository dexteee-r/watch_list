import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { tap } from '../motion.js'

export default function EpisodeGrid({ episodes, watchedSet, onToggle, disabled = false }) {
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
            <div className="mb-3 flex items-baseline justify-between border-b border-zinc-800/80 pb-2">
              <h3 className="font-semibold text-zinc-200">Saison {season}</h3>
              <span
                className={`text-sm tabular-nums ${allWatched ? 'text-amber-400' : 'text-zinc-500'}`}
              >
                {watchedCount}/{eps.length}
              </span>
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
