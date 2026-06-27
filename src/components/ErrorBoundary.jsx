import { Component } from 'react'
import { WarningOctagon, ArrowClockwise } from '@phosphor-icons/react'

/**
 * Capture les erreurs de rendu non gérées (composants enfants) et affiche un
 * écran de repli au lieu d'un écran blanc. Les erreurs dans les gestionnaires
 * d'événements ne sont PAS capturées (limite des Error Boundaries React) — elles
 * restent gérées localement par les états d'erreur des pages.
 *
 * Astuce : monter avec une `key` qui change à la navigation (ex. le pathname)
 * remonte le boundary à chaque route, ce qui le réarme automatiquement.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erreur non gérée dans le rendu :', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
        >
          <WarningOctagon size={48} weight="duotone" className="text-amber-400" />
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-zinc-100">Une erreur est survenue</h2>
            <p className="max-w-sm text-sm text-zinc-400">
              L&apos;affichage a rencontré un problème inattendu. Recharge la page pour réessayer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 active:scale-95"
          >
            <ArrowClockwise size={16} weight="bold" />
            Recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
