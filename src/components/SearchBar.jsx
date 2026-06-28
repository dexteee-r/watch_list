import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MagnifyingGlass, Plus, Check, CircleNotch } from '@phosphor-icons/react'
import { searchShows } from '../api/tvmaze.js'
import { addShow } from '../api/store.js'
import { EASE_OUT, tap } from '../motion.js'

const DEBOUNCE_MS = 200
const MAX_SUGGESTIONS = 8
const LISTBOX_ID = 'search-suggestions'
const optionId = (id) => `search-option-${id}`

export default function SearchBar({ onAdd }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1) // index dans les suggestions, -1 = aucune
  const [addedIds, setAddedIds] = useState(() => new Set())
  const [addingId, setAddingId] = useState(null)
  const containerRef = useRef(null)

  const suggestions = results.slice(0, MAX_SUGGESTIONS)
  const hasQuery = query.trim().length > 0
  // On montre le panneau dès qu'il y a une requête : suggestions, chargement, ou « rien trouvé ».
  const showPanel = open && hasQuery

  // Recherche debouncée. Toutes les mises à jour d'état se font dans le callback
  // du timer (jamais en synchrone dans le corps de l'effet). `ignore` protège
  // contre les réponses arrivées dans le désordre quand la requête change.
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
          setHighlight(-1)
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

  // Ferme le panneau au clic en dehors du composant.
  useEffect(() => {
    function onDocPointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocPointerDown)
    return () => document.removeEventListener('mousedown', onDocPointerDown)
  }, [])

  function selectShow(show) {
    if (!show) return
    setOpen(false)
    navigate(`/show/${show.id}`)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && suggestions[highlight]) {
        e.preventDefault()
        selectShow(suggestions[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

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
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MagnifyingGlass
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={
            highlight >= 0 && suggestions[highlight] ? optionId(suggestions[highlight].id) : undefined
          }
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => hasQuery && setOpen(true)}
          onKeyDown={handleKeyDown}
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
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-xl shadow-black/40 backdrop-blur-sm"
          >
            {suggestions.length > 0 ? (
              <ul id={LISTBOX_ID} role="listbox" className="max-h-[26rem] divide-y divide-zinc-800 overflow-y-auto">
                {suggestions.map((show, i) => {
                  const year = show.premiered ? show.premiered.slice(0, 4) : '—'
                  const added = addedIds.has(show.id)
                  const adding = addingId === show.id
                  const active = i === highlight
                  return (
                    <li
                      key={show.id}
                      id={optionId(show.id)}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => selectShow(show)}
                      className={`flex cursor-pointer items-center gap-3 p-3 transition-colors ${
                        active ? 'bg-zinc-800/70' : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {show.image?.medium ? (
                        <img
                          src={show.image.medium}
                          alt=""
                          loading="lazy"
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
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!added && !adding) handleAdd(show)
                        }}
                        disabled={added || adding}
                        whileTap={added ? undefined : tap}
                        transition={{ duration: 0.15, ease: EASE_OUT }}
                        aria-label={added ? `« ${show.name} » est dans ta liste` : `Ajouter « ${show.name} »`}
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
                    </li>
                  )
                })}
              </ul>
            ) : (
              !loading && (
                <p className="p-4 text-sm text-zinc-500">Aucune série trouvée pour « {query.trim()} ».</p>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
