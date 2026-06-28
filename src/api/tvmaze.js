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
