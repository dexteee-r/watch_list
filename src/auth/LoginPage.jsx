import { useState } from 'react'
import { motion } from 'framer-motion'
import { FilmSlate, CircleNotch } from '@phosphor-icons/react'
import { useAuth } from './context.js'
import { tap } from '../motion.js'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message ?? 'Connexion impossible.')
      setSubmitting(false)
    }
  }

  const field =
    'w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20'

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <FilmSlate size={36} weight="duotone" className="text-amber-400" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">Watch List</h1>
          <p className="mt-1 text-sm text-zinc-500">Connecte-toi pour accéder à ta liste.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              placeholder="toi@exemple.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          <motion.button
            type="submit"
            disabled={submitting}
            whileTap={tap}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <CircleNotch size={16} className="animate-spin" /> Connexion…
              </>
            ) : (
              'Se connecter'
            )}
          </motion.button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-600">
          Pas de compte ? Demande à l'administrateur de t'en créer un.
        </p>
      </motion.div>
    </div>
  )
}
