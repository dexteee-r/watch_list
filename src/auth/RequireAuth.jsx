import { CircleNotch } from '@phosphor-icons/react'
import { useAuth } from './context.js'
import LoginPage from './LoginPage.jsx'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950">
        <CircleNotch size={32} className="animate-spin text-amber-400" />
      </div>
    )
  }
  if (!user) return <LoginPage />
  return children
}
