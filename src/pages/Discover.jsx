import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import SearchBar from '../components/SearchBar.jsx'
import DiscoverCard from '../components/DiscoverCard.jsx'
import { ShowCardSkeleton } from '../components/Skeleton.jsx'
import { getPopularShows } from '../api/tvmaze.js'
import { getShows } from '../api/store.js'
import { staggerContainer } from '../motion.js'

export default function Discover() {
  const [shows, setShows] = useState([])
  const [listedIds, setListedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [popular, mine] = await Promise.all([getPopularShows(), getShows()])
        if (!active) return
        setShows(popular)
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

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Découvrir</h1>
        <p className="mt-1.5 text-zinc-400">
          Parcours les séries populaires ou recherche un titre, puis ajoute-le à ta liste.
        </p>
      </div>

      <SearchBar onAdd={handleAdded} />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <ShowCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      ) : (
        <div>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Populaires
          </h2>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {shows.map((show) => (
              <DiscoverCard
                key={show.id}
                show={show}
                inList={listedIds.has(show.id)}
                onAdd={handleAdded}
              />
            ))}
          </motion.div>
        </div>
      )}
    </section>
  )
}
