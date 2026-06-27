import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { CircleNotch, FilmSlate, SignOut } from '@phosphor-icons/react'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { useAuth } from './auth/context.js'
import RequireAuth from './auth/RequireAuth.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { pageVariants, pageTransition, tap } from './motion.js'

// Pages chargées à la demande : chaque route forme son propre chunk, allégeant
// le bundle initial (le détail tire EpisodeGrid, la découverte tire DiscoverCard…).
const Discover = lazy(() => import('./pages/Discover.jsx'))
const WatchList = lazy(() => import('./pages/WatchList.jsx'))
const ShowDetail = lazy(() => import('./pages/ShowDetail.jsx'))

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Chargement">
      <CircleNotch size={32} className="animate-spin text-amber-400" />
    </div>
  )
}

function navClass({ isActive }) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'
  }`
}

function UserMenu() {
  const { user, signOut } = useAuth()
  if (!user) return null
  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden max-w-[12rem] truncate text-sm text-zinc-400 sm:inline"
        title={user.email}
      >
        {user.email}
      </span>
      <motion.button
        type="button"
        onClick={() => signOut()}
        whileTap={tap}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <SignOut size={16} />
        <span className="hidden sm:inline">Déconnexion</span>
      </motion.button>
    </div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        {/* `key` = pathname → le boundary se réarme à chaque navigation (un crash
            de page n'enferme pas l'app, changer de route en sort). */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <Routes location={location}>
              <Route path="/" element={<Discover />} />
              <Route path="/watchlist" element={<WatchList />} />
              <Route path="/show/:id" element={<ShowDetail />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MotionConfig reducedMotion="user">
        <RequireAuth>
          <BrowserRouter>
            <div className="min-h-[100dvh] bg-zinc-950">
              <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
                  <Link to="/" className="group flex items-center gap-2">
                    <FilmSlate
                      size={24}
                      weight="duotone"
                      className="text-amber-400 transition-transform group-hover:-rotate-6"
                    />
                    <span className="text-lg font-semibold tracking-tight">Series Tracker</span>
                  </Link>

                  <nav className="flex items-center gap-1">
                    <NavLink to="/" end className={navClass}>
                      Découvrir
                    </NavLink>
                    <NavLink to="/watchlist" className={navClass}>
                      Ma liste
                    </NavLink>
                  </nav>

                  <div className="ml-auto">
                    <UserMenu />
                  </div>
                </div>
              </header>

              <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                <AnimatedRoutes />
              </main>
            </div>
          </BrowserRouter>
        </RequireAuth>
      </MotionConfig>
    </AuthProvider>
  )
}
