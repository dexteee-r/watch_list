import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MagnifyingGlass, Plus, Check, CircleNotch } from '@phosphor-icons/react'
import { searchShows } from '../api/tvmaze.js'
import { addShow } from '../api/store.js'
import { EASE_OUT, staggerContainer, riseItem, tap } from '../motion.js'

const DEBOUNCE_MS = 300

export default function SearchBar({ onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [addedIds, setAddedIds] = useState(() => new Set())
  const [addingId, setAddingId] = useState(null)

  // Debounced search. All state updates happen inside the timer callback
  // (never synchronously in the effect body). `ignore` guards against
  // out-of-order responses when the query changes mid-flight.
  useEffect(() => {
    const q = query.trim()
    let ignore = false

    const timer = setTimeout(async () => {
      if (!q) {
        if (!ignore) {
          setResults([])
          setError(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const shows = await searchShows(q)
        if (!ignore) {
          setResults(shows)
          setError(null)
        }
      } catch {
        if (!ignore) setError('La recherche a échoué. Réessaie.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [query])

  async function handleAdd(show) {
    setAddingId(show.id)
    try {
      await addShow(show.id)
      setAddedIds((prev) => new Set(prev).add(show.id))
      onAdd?.(show.id)
    } catch {
      setError(`Impossible d'ajouter « ${show.name} ».`)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div>
      <div className="relative">
        <MagnifyingGlass
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une série…"
          aria-label="Rechercher une série"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-3 pl-12 pr-4 text-base text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
        />
        {loading && (
          <CircleNotch
            size={20}
            className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-zinc-500"
          />
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60"
          >
            {results.slice(0, 8).map((show) => {
              const year = show.premiered ? show.premiered.slice(0, 4) : '—'
              const added = addedIds.has(show.id)
              const adding = addingId === show.id
              return (
                <motion.li
                  key={show.id}
                  variants={riseItem}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-zinc-800/40"
                >
                  {show.image?.medium ? (
                    <img
                      src={show.image.medium}
                      alt={show.name}
                      className="h-16 w-11 flex-shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs text-zinc-600">
                      N/A
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">{show.name}</p>
                    <p className="truncate text-sm text-zinc-500">
                      {year}
                      {show.genres?.length ? ` · ${show.genres.join(', ')}` : ''}
                    </p>
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => handleAdd(show)}
                    disabled={added || adding}
                    whileTap={added ? undefined : tap}
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      added
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
                    } disabled:cursor-default`}
                  >
                    {added ? (
                      <>
                        <Check size={16} weight="bold" /> Ajouté
                      </>
                    ) : adding ? (
                      <CircleNotch size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Plus size={16} weight="bold" /> Ajouter
                      </>
                    )}
                  </motion.button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
