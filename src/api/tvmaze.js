// Pure fetch helpers for the TVmaze API. No business logic, no DB access.
// TVmaze needs no API key and sends CORS `*`, so it is called directly from the browser.
const BASE_URL = 'https://api.tvmaze.com'

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`TVmaze request failed (${res.status}) for ${url}`)
  }
  return res.json()
}

/**
 * Search shows by name.
 * @param {string} query
 * @returns {Promise<Array>} list of show objects (the `score` wrapper is stripped)
 */
export async function searchShows(query) {
  const trimmed = query.trim()
  if (!trimmed) return []
  const results = await getJson(`${BASE_URL}/search/shows?q=${encodeURIComponent(trimmed)}`)
  return results.map((item) => item.show)
}

/**
 * Get full details for a single show.
 * @param {number} id TVmaze show id
 */
export function getShowDetails(id) {
  return getJson(`${BASE_URL}/shows/${id}`)
}

/**
 * Get every episode of a show in one call (each has `season` and `number`).
 * @param {number} id TVmaze show id
 */
export function getEpisodes(id) {
  return getJson(`${BASE_URL}/shows/${id}/episodes`)
}

/**
 * Popular shows for the Discover page. TVmaze has no "popular" endpoint, so we
 * pull the index and sort by `weight` (TVmaze's own popularity score, 0-100).
 * @param {number} limit how many shows to return
 */
export async function getPopularShows(limit = 48) {
  const shows = await getJson(`${BASE_URL}/shows?page=0`)
  return shows
    .filter((s) => s.image?.medium)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, limit)
}

/**
 * One page of the TVmaze show index (~250 shows, ordered by id). TVmaze has no
 * server-side filtering/sorting, so the Discover page loads pages and filters
 * client-side. We keep only shows usable in the grid (image + name).
 * Pages past the end of the index return 404 → we return [] (no more shows).
 * @param {number} page 0-based page number
 * @returns {Promise<Array>} show objects (with genres, type, language, premiered, rating, weight)
 */
export async function getShowsPage(page = 0) {
  const res = await fetch(`${BASE_URL}/shows?page=${page}`)
  if (res.status === 404) return [] // au-delà de la dernière page d'index
  if (!res.ok) throw new Error(`TVmaze request failed (${res.status}) for page ${page}`)
  const shows = await res.json()
  return shows.filter((s) => s.image?.medium && s.name)
}

// Cache (par session) du numéro de la dernière page d'index, pour ne sonder qu'une fois.
let _lastPageCache = null

/**
 * Numéro de la dernière page valide de l'index TVmaze (recherche dichotomique).
 * Les pages au-delà de la fin renvoient 404 → `getShowsPage` renvoie []. ~log2(n) requêtes.
 */
async function findLastPage() {
  if (_lastPageCache !== null) return _lastPageCache
  let lo = 0
  let hi = 256
  // Étend hi jusqu'à dépasser la fin (page vide).
  while ((await getShowsPage(hi)).length > 0) {
    lo = hi
    hi *= 2
    if (hi > 4096) break // garde-fou
  }
  // Dichotomie entre lo (valide) et hi (vide).
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if ((await getShowsPage(mid)).length > 0) lo = mid
    else hi = mid
  }
  _lastPageCache = lo
  return lo
}

/**
 * Séries les plus récemment ajoutées au catalogue (= les plus récentes en pratique).
 * TVmaze paginant par id croissant (anciennes d'abord) et n'ayant pas de tri par date,
 * on charge les DERNIÈRES pages de l'index pour obtenir les nouveautés (2025-2026…).
 * @param {number} pages combien de pages de fin charger
 * @returns {Promise<Array>} séries récentes (avec image + nom)
 */
export async function getRecentShows(pages = 3) {
  const last = await findLastPage()
  const wanted = []
  for (let p = last; p > last - pages && p >= 0; p--) wanted.push(p)
  const results = await Promise.all(wanted.map((p) => getShowsPage(p)))
  return results.flat()
}

/**
 * Derive the available filter options (facets) from a set of shows.
 * @param {Array} shows
 * @returns {{ genres: string[], types: string[], languages: string[] }} sorted, unique
 */
export function extractFacets(shows) {
  const genres = new Set()
  const types = new Set()
  const languages = new Set()
  for (const s of shows) {
    s.genres?.forEach((g) => genres.add(g))
    if (s.type) types.add(s.type)
    if (s.language) languages.add(s.language)
  }
  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b))
  return { genres: sorted(genres), types: sorted(types), languages: sorted(languages) }
}
