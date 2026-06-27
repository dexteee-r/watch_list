import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FilmReel } from '@phosphor-icons/react'
import ShowCard from '../components/ShowCard.jsx'
import { ShowCardSkeleton } from '../components/Skeleton.jsx'
import { getShowsWithProgress, removeShow, STATUSES } from '../api/store.js'
import { STATUS_LABELS } from '../labels.js'
import { staggerContainer } from '../motion.js'

export default function WatchList() {
  const [shows, setShows] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await getShowsWithProgress()
    setShows(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const data = await getShowsWithProgress()
      if (active) {
        setShows(data)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function handleRemove(id) {
    await removeShow(id)
    await reload()
  }

  const filtered = useMemo(
    () => (filter === 'all' ? shows : shows.filter((s) => s.status === filter)),
    [shows, filter],
  )

  const filters = ['all', ...STATUSES]

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ma liste</h1>
        <p className="mt-1.5 text-zinc-400">Suis l'avancement de tes séries.</p>
      </div>

      {/* Status filter */}
      {shows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const count =
              f === 'all' ? shows.length : shows.filter((s) => s.status === f).length
            const active = filter === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition active:scale-95 ${
                  active
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-zinc-900/60 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {f === 'all' ? 'Toutes' : STATUS_LABELS[f]}{' '}
                <span className={active ? 'text-zinc-500' : 'text-zinc-600'}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ShowCardSkeleton key={i} />
          ))}
        </div>
      ) : shows.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <p className="text-zinc-400">Aucune série avec ce statut.</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {filtered.map((show) => (
            <ShowCard key={show.tvmaze_id} show={show} onRemove={handleRemove} />
          ))}
        </motion.div>
      )}
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-800">
        <FilmReel size={28} weight="duotone" className="text-zinc-500" />
      </div>
      <h2 className="mt-4 font-medium text-zinc-200">Ta liste est vide</h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Va sur la page Découvrir pour ajouter des séries à suivre.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 active:scale-95"
      >
        Découvrir des séries
      </Link>
    </div>
  )
}
