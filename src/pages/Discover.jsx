import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FunnelX, CircleNotch } from '@phosphor-icons/react'
import SearchBar from '../components/SearchBar.jsx'
import DiscoverCard from '../components/DiscoverCard.jsx'
import { ShowCardSkeleton } from '../components/Skeleton.jsx'
import { getShowsPage, extractFacets } from '../api/tvmaze.js'
import { getShows } from '../api/store.js'
import { staggerContainer } from '../motion.js'

const DISPLAY_STEP = 48

// Statuts TVmaze → libellés FR.
const STATUS_LABELS = {
  Running: 'En cours',
  Ended: 'Terminé',
  'To Be Determined': 'À déterminer',
  'In Development': 'En développement',
}

// Critères de tri (clé → libellé + comparateur).
const SORTS = {
  popularity: ['Popularité', (a, b) => (b.weight ?? 0) - (a.weight ?? 0)],
  name_asc: ['Nom A→Z', (a, b) => a.name.localeCompare(b.name)],
  name_desc: ['Nom Z→A', (a, b) => b.name.localeCompare(a.name)],
  year_desc: ['Plus récent', (a, b) => (b.premiered ?? '').localeCompare(a.premiered ?? '')],
  year_asc: ['Plus ancien', (a, b) => (a.premiered ?? '').localeCompare(b.premiered ?? '')],
  rating: ['Mieux noté', (a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0)],
}

function mergeUnique(prev, next) {
  const seen = new Set(prev.map((s) => s.id))
  return [...prev, ...next.filter((s) => !seen.has(s.id))]
}

function FilterSelect({ label, allLabel, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[8rem] rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function Discover() {
  const [shows, setShows] = useState([])
  const [listedIds, setListedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Pagination : combien de cartes affichées + jusqu'où on a chargé l'index TVmaze.
  const [displayCount, setDisplayCount] = useState(DISPLAY_STEP)
  const [loadedPage, setLoadedPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Filtres + tri.
  const [genre, setGenre] = useState('')
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  const [status, setStatus] = useState('')
  const [language, setLanguage] = useState('')
  const [sort, setSort] = useState('popularity')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [page0, mine] = await Promise.all([getShowsPage(0), getShows()])
        if (!active) return
        setShows(page0)
        setListedIds(new Set(mine.map((s) => s.tvmaze_id)))
        setLoading(false)
      } catch {
        if (active) {
          setError('Impossible de charger les séries.')
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  function handleAdded(id) {
    setListedIds((prev) => new Set(prev).add(id))
  }

  // Changer un filtre/tri repart de la première « page » d'affichage.
  function setFilter(setter) {
    return (v) => {
      setter(v)
      setDisplayCount(DISPLAY_STEP)
    }
  }

  function resetFilters() {
    setGenre('')
    setType('')
    setYear('')
    setStatus('')
    setLanguage('')
    setSort('popularity')
    setDisplayCount(DISPLAY_STEP)
  }

  async function loadMore() {
    setDisplayCount((c) => c + DISPLAY_STEP)
    // Recharge une page d'index TVmaze si le pool local s'amenuise.
    if (hasMore && !loadingMore && shows.length - displayCount < 2 * DISPLAY_STEP) {
      setLoadingMore(true)
      try {
        const next = await getShowsPage(loadedPage + 1)
        if (next.length === 0) {
          setHasMore(false)
        } else {
          setShows((prev) => mergeUnique(prev, next))
          setLoadedPage((p) => p + 1)
        }
      } catch {
        /* on garde ce qu'on a déjà */
      } finally {
        setLoadingMore(false)
      }
    }
  }

  // Options de filtres déduites des séries chargées.
  const facets = useMemo(() => extractFacets(shows), [shows])
  const years = useMemo(
    () =>
      [...new Set(shows.map((s) => s.premiered?.slice(0, 4)).filter(Boolean))].sort((a, b) =>
        b.localeCompare(a),
      ),
    [shows],
  )
  const statuses = useMemo(
    () => [...new Set(shows.map((s) => s.status).filter(Boolean))].sort(),
    [shows],
  )

  // Filtrage + tri (client-side).
  const visible = useMemo(() => {
    const filtered = shows.filter(
      (s) =>
        (!genre || s.genres?.includes(genre)) &&
        (!type || s.type === type) &&
        (!year || s.premiered?.slice(0, 4) === year) &&
        (!status || s.status === status) &&
        (!language || s.language === language),
    )
    return filtered.sort(SORTS[sort][1])
  }, [shows, genre, type, year, status, language, sort])

  const anyFilter = genre || type || year || status || language || sort !== 'popularity'
  const canLoadMore = displayCount < visible.length || hasMore

  if (loading) {
    return (
      <section className="space-y-8">
        <DiscoverHeader />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <ShowCardSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <DiscoverHeader />
      <SearchBar onAdd={handleAdded} />

      {error ? (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      ) : (
        <div className="space-y-5">
          {/* Barre de filtres + tri */}
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
              label="Genre"
              allLabel="Tous les genres"
              value={genre}
              onChange={setFilter(setGenre)}
              options={facets.genres.map((g) => ({ value: g, label: g }))}
            />
            <FilterSelect
              label="Type"
              allLabel="Tous les types"
              value={type}
              onChange={setFilter(setType)}
              options={facets.types.map((t) => ({ value: t, label: t }))}
            />
            <FilterSelect
              label="Année"
              allLabel="Toutes les années"
              value={year}
              onChange={setFilter(setYear)}
              options={years.map((y) => ({ value: y, label: y }))}
            />
            <FilterSelect
              label="Statut"
              allLabel="Tous les statuts"
              value={status}
              onChange={setFilter(setStatus)}
              options={statuses.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))}
            />
            <FilterSelect
              label="Langue"
              allLabel="Toutes les langues"
              value={language}
              onChange={setFilter(setLanguage)}
              options={facets.languages.map((l) => ({ value: l, label: l }))}
            />
            <FilterSelect
              label="Trier par"
              allLabel="Popularité"
              value={sort === 'popularity' ? '' : sort}
              onChange={(v) => {
                setSort(v || 'popularity')
                setDisplayCount(DISPLAY_STEP)
              }}
              options={Object.entries(SORTS)
                .filter(([k]) => k !== 'popularity')
                .map(([k, [lbl]]) => ({ value: k, label: lbl }))}
            />
            {anyFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <FunnelX size={16} /> Réinitialiser
              </button>
            )}
          </div>

          <p className="text-sm text-zinc-500">
            {visible.length} série{visible.length > 1 ? 's' : ''}
            {visible.length > displayCount ? ` (${displayCount} affichées)` : ''}
          </p>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
              <p className="text-zinc-400">Aucune série ne correspond à ces filtres.</p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            >
              {visible.slice(0, displayCount).map((show) => (
                <DiscoverCard
                  key={show.id}
                  show={show}
                  inList={listedIds.has(show.id)}
                  onAdd={handleAdded}
                />
              ))}
            </motion.div>
          )}

          {canLoadMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 active:scale-95 disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" /> Chargement…
                  </>
                ) : (
                  'Charger plus'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function DiscoverHeader() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Découvrir</h1>
      <p className="mt-1.5 text-zinc-400">
        Parcours les séries, filtre et trie, ou recherche un titre — puis ajoute-le à ta liste.
      </p>
    </div>
  )
}
