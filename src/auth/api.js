// Appels d'authentification vers le backend (cookie de session httpOnly).
const API = '/api/auth'

export async function fetchMe() {
  const res = await fetch(`${API}/me`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Impossible de vérifier la session.')
  return res.json()
}

export async function login(email, password) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.ok) return res.json()
  if (res.status === 401) throw new Error('Email ou mot de passe invalide.')
  if (res.status === 422) throw new Error("Format d'email invalide.")
  throw new Error('Connexion impossible, réessaie.')
}

export async function logout() {
  await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' })
}
