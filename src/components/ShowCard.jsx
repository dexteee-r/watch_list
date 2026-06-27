import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trash } from '@phosphor-icons/react'
import ProgressBar from './ProgressBar.jsx'
import { STATUS_LABELS, STATUS_BADGE_STYLES } from '../labels.js'
import { riseItem, SPRING } from '../motion.js'

export default function ShowCard({ show, onRemove }) {
  function handleRemove(e) {
    e.preventDefault()
    if (window.confirm(`Retirer « ${show.name} » de ta liste ?`)) {
      onRemove(show.tvmaze_id)
    }
  }

  return (
    <motion.div variants={riseItem} layout className="group relative">
      <Link
        to={`/show/${show.tvmaze_id}`}
        className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-700"
      >
        {/* Poster */}
        <div className="relative overflow-hidden">
          {show.poster_url ? (
            <motion.img
              src={show.poster_url}
              alt={show.name}
              className="aspect-2/3 w-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={SPRING}
            />
          ) : (
            <div className="flex aspect-2/3 w-full items-center justify-center bg-zinc-800 text-sm text-zinc-600">
              Pas d'image
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent" />

          <button
            type="button"
            onClick={handleRemove}
            aria-label={`Retirer ${show.name}`}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950/70 text-zinc-300 opacity-0 backdrop-blur-sm transition hover:bg-rose-500 hover:text-white focus:opacity-100 group-hover:opacity-100 active:scale-95"
          >
            <Trash size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-2 p-3">
          <p className="line-clamp-1 font-medium leading-tight text-zinc-100">
            {show.name}
          </p>
          <span
            className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[show.status] ?? ''}`}
          >
            {STATUS_LABELS[show.status] ?? show.status}
          </span>
          <ProgressBar value={show.watched} max={show.total_episodes} />
        </div>
      </Link>
    </motion.div>
  )
}
