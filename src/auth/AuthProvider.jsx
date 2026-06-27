import { useCallback, useEffect, useState } from 'react'
import { AuthContext } from './context.js'
import { fetchMe, login as apiLogin, logout as apiLogout } from './api.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Au montage : vérifie s'il y a déjà une session valide (cookie).
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const me = await fetchMe()
        if (active) setUser(me)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setUser(await apiLogin(email, password))
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
