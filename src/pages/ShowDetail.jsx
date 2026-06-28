import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CaretLeft, Plus, CaretDown } from '@phosphor-icons/react'
import EpisodeGrid from '../components/EpisodeGrid.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { getShowDetails, getEpisodes } from '../api/tvmaze.js'
import {
  getShow,
  getProgress,
  addShow,
  setStatus,
  markWatched,
  unmarkWatched,
  getRatings,
  setRating,
  deleteRating,
  STATUSES,
} from '../api/store.js'
import { STATUS_LABELS } from '../labels.js'
import { EASE_OUT, tap } from '../motion.js'

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, '') : ''
}

export default function ShowDetail() {
  const id = Number(useParams().id)

  const [details, setDetails] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [localShow, setLocalShow] = useState(null)
  const [watchedSet, setWatchedSet] = useState(() => new Set())
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [det, eps, local, prog, rats] = await Promise.all([
          getShowDetails(id),
          getEpisodes(id),
          getShow(id),
          getProgress(id),
          getRatings(id),
        ])
        if (!active) return
        setDetails(det)
        setEpisodes(eps)
        setLocalShow(local ?? null)
        setWatchedSet(new Set(prog.map((p) => `${p.season}-${p.episode}`)))
        setRatings(Object.fromEntries(rats.map((r) => [r.season, r.rating])))
        setLoading(false)
      } catch {
        if (active) {
          setError('Impossible de charger cette série.')
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  const tracked = localShow !== null

  async function handleToggle(season, number, watched) {
    if (!tracked) return
    const key = `${season}-${number}`
    if (watched) await unmarkWatched(id, season, number)
    else await markWatched(id, season, number)
    setWatchedSet((prev) => {
      const next = new Set(prev)
      if (watched) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleStatusChange(status) {
    await setStatus(id, status)
    setLocalShow((prev) => ({ ...prev, status }))
  }

  async function handleRate(season, rating) {
    if (rating == null) {
      await deleteRating(id, season)
      setRatings((prev) => {
        const next = { ...prev }
        delete next[season]
        return next
      })
    } else {
      await setRating(id, season, rating)
      setRatings((prev) => ({ ...prev, [season]: rating }))
    }
  }

  async function handleAdd() {
    const added = await addShow(id, 'watching')
    setLocalShow(added)
  }

  if (loading) return <DetailSkeleton />
  if (error) return <p className="text-rose-400">{error}</p>

  return (
    <article className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        <CaretLeft size={16} weight="bold" /> Retour
      </Link>

      {/* Cinematic hero */}
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800">
        {details.image?.original || details.image?.medium ? (
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-2xl"
            style={{ backgroundImage: `url(${details.image.original ?? details.image.medium})` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-zinc-950/60" />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:p-7">
          {details.image?.medium ? (
            <motion.img
              src={details.image.medium}
              alt={details.name}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="h-64 w-44 flex-shrink-0 self-center rounded-xl object-cover shadow-2xl shadow-black/50 sm:self-start"
            />
          ) : null}

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {details.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {details.premiered?.slice(0, 4) ?? '—'}
                {details.genres?.length ? ` · ${details.genres.join(' · ')}` : ''}
              </p>
            </div>

            {tracked ? (
              <div className="relative inline-block">
                <select
                  value={localShow.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="appearance-none rounded-lg border border-zinc-700 bg-zinc-900/80 py-2 pl-3 pr-9 text-sm font-medium text-zinc-100 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-zinc-900">
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              </div>
            ) : (
              <motion.button
                type="button"
                onClick={handleAdd}
                whileTap={tap}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
              >
                <Plus size={16} weight="bold" /> Ajouter à ma liste
              </motion.button>
            )}

            <ProgressBar value={watchedSet.size} max={episodes.length} />

            {details.summary ? (
              <p className="max-w-prose text-sm leading-relaxed text-zinc-400">
                {stripHtml(details.summary)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {!tracked && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Ajoute cette série à ta liste pour suivre tes épisodes.
        </p>
      )}

      <EpisodeGrid
        episodes={episodes}
        watchedSet={watchedSet}
        onToggle={handleToggle}
        disabled={!tracked}
        ratings={ratings}
        onRate={handleRate}
      />
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
      <div className="flex flex-col gap-5 rounded-2xl border border-zinc-800 p-5 sm:flex-row sm:p-7">
        <div className="h-64 w-44 flex-shrink-0 animate-pulse rounded-xl bg-zinc-800" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-800" />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-zinc-800" />
          <div className="h-2 w-full animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}
