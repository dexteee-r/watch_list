import { createContext, useContext } from 'react'

// Séparé du composant AuthProvider pour satisfaire react-refresh
// (un fichier ne doit pas exporter à la fois un composant et un hook).
export const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un <AuthProvider>.')
  }
  return ctx
}
