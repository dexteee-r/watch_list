// Couche données de l'app : parle au backend (FastAPI) via fetch.
// Mêmes 9 signatures que l'ancien store Dexie — l'UI est inchangée.
// `credentials: 'include'` → le cookie de session httpOnly accompagne chaque requête.
const API = '/api'

export const STATUSES = ['watching', 'completed', 'dropped', 'plan_to_watch']

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail
    try {
      detail = (await res.json()).detail
    } catch {
      /* corps non-JSON */
    }
    throw new Error(typeof detail === 'string' ? detail : `Erreur ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

export function getShows() {
  return request('/shows')
}

export function getShowsWithProgress() {
  return request('/shows')
}

export async function getShow(tvmazeId) {
  const res = await fetch(`${API}/shows/${tvmazeId}`, { credentials: 'include' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  return res.json()
}

export function addShow(tvmazeId, status = 'plan_to_watch') {
  return request('/shows', {
    method: 'POST',
    body: JSON.stringify({ tvmaze_id: tvmazeId, status }),
  })
}

export function removeShow(tvmazeId) {
  return request(`/shows/${tvmazeId}`, { method: 'DELETE' })
}

export function setStatus(tvmazeId, status) {
  return request(`/shows/${tvmazeId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function getProgress(tvmazeId) {
  return request(`/shows/${tvmazeId}/progress`)
}

export function markWatched(tvmazeId, season, episode) {
  return request(`/shows/${tvmazeId}/progress`, {
    method: 'POST',
    body: JSON.stringify({ season, episode }),
  })
}

export function unmarkWatched(tvmazeId, season, episode) {
  return request(`/shows/${tvmazeId}/progress/${season}/${episode}`, { method: 'DELETE' })
}

// Confort de dev : accès aux fonctions depuis la console.
if (import.meta.env.DEV) {
  window.tracker = {
    getShows,
    getShowsWithProgress,
    getShow,
    addShow,
    removeShow,
    setStatus,
    getProgress,
    markWatched,
    unmarkWatched,
  }
}
