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
