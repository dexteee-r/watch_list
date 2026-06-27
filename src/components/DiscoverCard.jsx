import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Check, CircleNotch } from '@phosphor-icons/react'
import { addShow } from '../api/store.js'
import { riseItem, SPRING, tap } from '../motion.js'

export default function DiscoverCard({ show, inList, onAdd }) {
  const [locallyAdded, setLocallyAdded] = useState(false)
  const [adding, setAdding] = useState(false)
  const added = inList || locallyAdded
  const year = show.premiered ? show.premiered.slice(0, 4) : '—'

  async function handleAdd(e) {
    e.preventDefault() // don't follow the card link
    if (added || adding) return
    setAdding(true)
    try {
      await addShow(show.id, 'plan_to_watch')
      setLocallyAdded(true)
      onAdd?.(show.id)
    } finally {
      setAdding(false)
    }
  }

  return (
    <motion.div variants={riseItem} layout className="group relative">
      <Link
        to={`/show/${show.id}`}
        className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-700"
      >
        <div className="relative overflow-hidden">
          {show.image?.medium ? (
            <motion.img
              src={show.image.medium}
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

          <motion.button
            type="button"
            onClick={handleAdd}
            disabled={added || adding}
            whileTap={added ? undefined : tap}
            aria-label={added ? `${show.name} dans ma liste` : `Ajouter ${show.name}`}
            className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition ${
              added
                ? 'bg-emerald-500/90 text-white'
                : 'bg-zinc-950/70 text-zinc-100 opacity-0 hover:bg-amber-400 hover:text-zinc-950 focus:opacity-100 group-hover:opacity-100'
            }`}
          >
            {added ? (
              <Check size={16} weight="bold" />
            ) : adding ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <Plus size={16} weight="bold" />
            )}
          </motion.button>
        </div>

        <div className="p-3">
          <p className="line-clamp-1 font-medium leading-tight text-zinc-100">{show.name}</p>
          <p className="line-clamp-1 text-sm text-zinc-500">
            {year}
            {show.genres?.length ? ` · ${show.genres.slice(0, 2).join(', ')}` : ''}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}
