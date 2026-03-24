/**
 * Batch generator — 20 Entertainment + 20 Sports MCP servers
 * Run: cd /Users/lex/settlegrid && node scripts/batch-entertainment-sports.mjs
 */

import { generateServer } from './lib/generate.mjs'

console.log('\n=== Entertainment Servers (20) ===\n')

// ─── 151. TMDB ──────────────────────────────────────────────────────────────
generateServer({
  slug: 'tmdb',
  name: 'TMDB (The Movie Database)',
  description: 'Search movies, TV shows, and people via The Movie Database API.',
  keywords: ['entertainment', 'movies', 'tv', 'tmdb'],
  upstream: { provider: 'TMDB', baseUrl: 'https://api.themoviedb.org/3', auth: 'API key (query param)', rateLimit: '~40 req/10s', docsUrl: 'https://developer.themoviedb.org/docs' },
  auth: { type: 'key', keyEnvVar: 'TMDB_API_KEY', keyDesc: 'TMDB API key (free at themoviedb.org)' },
  methods: [
    { name: 'search_movies', displayName: 'Search Movies', costCents: 2, description: 'Search for movies by title', params: [{ name: 'query', type: 'string', required: true, description: 'Movie title to search for' }, { name: 'year', type: 'number', required: false, description: 'Filter by release year' }] },
    { name: 'search_tv', displayName: 'Search TV Shows', costCents: 2, description: 'Search for TV shows by name', params: [{ name: 'query', type: 'string', required: true, description: 'TV show name to search for' }] },
    { name: 'get_trending', displayName: 'Get Trending', costCents: 2, description: 'Get trending movies or TV shows', params: [{ name: 'media_type', type: 'string', required: true, description: '"movie" or "tv"' }, { name: 'time_window', type: 'string', required: false, description: '"day" or "week" (default: "week")' }] },
  ],
  serverTs: `/**
 * settlegrid-tmdb — The Movie Database MCP Server
 *
 * Wraps the TMDB API with SettleGrid billing.
 * Requires a free TMDB API key.
 *
 * Methods:
 *   search_movies(query, year?)       — Search movies by title      (2\u00A2)
 *   search_tv(query)                  — Search TV shows by name     (2\u00A2)
 *   get_trending(media_type, window?) — Get trending content        (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchMoviesInput {
  query: string
  year?: number
}

interface SearchTvInput {
  query: string
}

interface TrendingInput {
  media_type: string
  time_window?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.themoviedb.org/3'
const API_KEY = process.env.TMDB_API_KEY || ''

async function tmdbFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('TMDB_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${BASE}\${path}\${sep}api_key=\${API_KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`TMDB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tmdb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_movies: { costCents: 2, displayName: 'Search Movies' },
      search_tv: { costCents: 2, displayName: 'Search TV Shows' },
      get_trending: { costCents: 2, displayName: 'Get Trending' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMovies = sg.wrap(async (args: SearchMoviesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const yearParam = args.year ? \`&year=\${args.year}\` : ''
  const data = await tmdbFetch<{ results: Array<{ id: number; title: string; release_date: string; overview: string; vote_average: number; poster_path: string | null }> }>(\`/search/movie?query=\${q}\${yearParam}\`)
  return {
    query: args.query,
    count: data.results.length,
    movies: data.results.slice(0, 10).map((m) => ({
      id: m.id,
      title: m.title,
      releaseDate: m.release_date,
      overview: m.overview?.slice(0, 300),
      rating: m.vote_average,
      poster: m.poster_path ? \`https://image.tmdb.org/t/p/w500\${m.poster_path}\` : null,
    })),
  }
}, { method: 'search_movies' })

const searchTv = sg.wrap(async (args: SearchTvInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const data = await tmdbFetch<{ results: Array<{ id: number; name: string; first_air_date: string; overview: string; vote_average: number }> }>(\`/search/tv?query=\${q}\`)
  return {
    query: args.query,
    count: data.results.length,
    shows: data.results.slice(0, 10).map((s) => ({
      id: s.id,
      name: s.name,
      firstAirDate: s.first_air_date,
      overview: s.overview?.slice(0, 300),
      rating: s.vote_average,
    })),
  }
}, { method: 'search_tv' })

const getTrending = sg.wrap(async (args: TrendingInput) => {
  const validTypes = ['movie', 'tv']
  if (!args.media_type || !validTypes.includes(args.media_type)) {
    throw new Error('media_type must be "movie" or "tv"')
  }
  const window = args.time_window === 'day' ? 'day' : 'week'
  const data = await tmdbFetch<{ results: Array<{ id: number; title?: string; name?: string; overview: string; vote_average: number; media_type: string }> }>(\`/trending/\${args.media_type}/\${window}\`)
  return {
    mediaType: args.media_type,
    timeWindow: window,
    results: data.results.slice(0, 10).map((r) => ({
      id: r.id,
      title: r.title || r.name,
      overview: r.overview?.slice(0, 300),
      rating: r.vote_average,
    })),
  }
}, { method: 'get_trending' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMovies, searchTv, getTrending }

console.log('settlegrid-tmdb MCP server ready')
console.log('Methods: search_movies, search_tv, get_trending')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 152. OMDB ──────────────────────────────────────────────────────────────
generateServer({
  slug: 'omdb',
  name: 'OMDb (Open Movie Database)',
  description: 'Search and retrieve detailed movie and TV show information from OMDb.',
  keywords: ['entertainment', 'movies', 'tv', 'omdb'],
  upstream: { provider: 'OMDb', baseUrl: 'https://www.omdbapi.com', auth: 'API key (query param)', rateLimit: '1000/day (free tier)', docsUrl: 'https://www.omdbapi.com/' },
  auth: { type: 'key', keyEnvVar: 'OMDB_API_KEY', keyDesc: 'OMDb API key (free at omdbapi.com)' },
  methods: [
    { name: 'search_title', displayName: 'Search by Title', costCents: 2, description: 'Search movies/shows by title', params: [{ name: 'query', type: 'string', required: true, description: 'Title to search for' }, { name: 'type', type: 'string', required: false, description: '"movie", "series", or "episode"' }] },
    { name: 'get_by_id', displayName: 'Get by IMDb ID', costCents: 2, description: 'Get detailed info by IMDb ID', params: [{ name: 'imdb_id', type: 'string', required: true, description: 'IMDb ID (e.g. "tt1375666")' }] },
  ],
  serverTs: `/**
 * settlegrid-omdb — Open Movie Database MCP Server
 *
 * Methods:
 *   search_title(query, type?)  — Search by title    (2\u00A2)
 *   get_by_id(imdb_id)          — Get by IMDb ID     (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  type?: string
}

interface GetByIdInput {
  imdb_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.omdbapi.com'
const API_KEY = process.env.OMDB_API_KEY || ''

async function omdbFetch<T>(params: string): Promise<T> {
  if (!API_KEY) throw new Error('OMDB_API_KEY environment variable is required')
  const res = await fetch(\`\${BASE}/?apikey=\${API_KEY}&\${params}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OMDb API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json() as T & { Response?: string; Error?: string }
  if (data.Response === 'False') {
    throw new Error(\`OMDb: \${data.Error || 'Unknown error'}\`)
  }
  return data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'omdb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_title: { costCents: 2, displayName: 'Search by Title' },
      get_by_id: { costCents: 2, displayName: 'Get by IMDb ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTitle = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const typeParam = args.type ? \`&type=\${encodeURIComponent(args.type)}\` : ''
  const data = await omdbFetch<{ Search: Array<{ Title: string; Year: string; imdbID: string; Type: string; Poster: string }>; totalResults: string }>(\`s=\${q}\${typeParam}\`)
  return {
    query: args.query,
    totalResults: parseInt(data.totalResults, 10),
    results: (data.Search || []).slice(0, 10).map((r) => ({
      title: r.Title,
      year: r.Year,
      imdbId: r.imdbID,
      type: r.Type,
      poster: r.Poster !== 'N/A' ? r.Poster : null,
    })),
  }
}, { method: 'search_title' })

const getById = sg.wrap(async (args: GetByIdInput) => {
  if (!args.imdb_id || typeof args.imdb_id !== 'string') {
    throw new Error('imdb_id is required (e.g. "tt1375666")')
  }
  if (!/^tt\\d{7,}$/.test(args.imdb_id)) {
    throw new Error('imdb_id must match format "tt" followed by 7+ digits')
  }
  const data = await omdbFetch<{ Title: string; Year: string; Rated: string; Runtime: string; Genre: string; Director: string; Actors: string; Plot: string; imdbRating: string; imdbID: string; Type: string }>(\`i=\${args.imdb_id}&plot=full\`)
  return {
    title: data.Title,
    year: data.Year,
    rated: data.Rated,
    runtime: data.Runtime,
    genre: data.Genre,
    director: data.Director,
    actors: data.Actors,
    plot: data.Plot,
    imdbRating: data.imdbRating,
    imdbId: data.imdbID,
    type: data.Type,
  }
}, { method: 'get_by_id' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTitle, getById }

console.log('settlegrid-omdb MCP server ready')
console.log('Methods: search_title, get_by_id')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 153. TVMaze ────────────────────────────────────────────────────────────
generateServer({
  slug: 'tvmaze',
  name: 'TVMaze',
  description: 'Search TV shows, get episode guides, and schedule data from TVMaze.',
  keywords: ['entertainment', 'tv', 'shows', 'episodes'],
  upstream: { provider: 'TVMaze', baseUrl: 'https://api.tvmaze.com', auth: 'None required', rateLimit: '20 req/10s', docsUrl: 'https://www.tvmaze.com/api' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_shows', displayName: 'Search Shows', costCents: 1, description: 'Search TV shows by name', params: [{ name: 'query', type: 'string', required: true, description: 'Show name to search for' }] },
    { name: 'get_episodes', displayName: 'Get Episodes', costCents: 1, description: 'Get episode list for a show', params: [{ name: 'show_id', type: 'number', required: true, description: 'TVMaze show ID' }] },
    { name: 'get_schedule', displayName: 'Get Schedule', costCents: 1, description: 'Get TV schedule for a date/country', params: [{ name: 'country', type: 'string', required: false, description: 'ISO country code (default: "US")' }, { name: 'date', type: 'string', required: false, description: 'Date in YYYY-MM-DD format' }] },
  ],
  serverTs: `/**
 * settlegrid-tvmaze — TVMaze MCP Server
 *
 * Methods:
 *   search_shows(query)              — Search TV shows       (1\u00A2)
 *   get_episodes(show_id)            — Get episode list      (1\u00A2)
 *   get_schedule(country?, date?)    — Get TV schedule       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface EpisodesInput { show_id: number }
interface ScheduleInput { country?: string; date?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.tvmaze.com'

async function tvFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`TVMaze API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tvmaze',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_shows: { costCents: 1, displayName: 'Search Shows' },
      get_episodes: { costCents: 1, displayName: 'Get Episodes' },
      get_schedule: { costCents: 1, displayName: 'Get Schedule' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchShows = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const data = await tvFetch<Array<{ score: number; show: { id: number; name: string; language: string; genres: string[]; premiered: string; rating: { average: number | null }; summary: string | null } }>>(\`/search/shows?q=\${q}\`)
  return {
    query: args.query,
    count: data.length,
    shows: data.slice(0, 10).map((r) => ({
      id: r.show.id,
      name: r.show.name,
      language: r.show.language,
      genres: r.show.genres,
      premiered: r.show.premiered,
      rating: r.show.rating?.average,
      summary: r.show.summary?.replace(/<[^>]*>/g, '').slice(0, 300),
    })),
  }
}, { method: 'search_shows' })

const getEpisodes = sg.wrap(async (args: EpisodesInput) => {
  if (typeof args.show_id !== 'number' || args.show_id <= 0) {
    throw new Error('show_id must be a positive number')
  }
  const data = await tvFetch<Array<{ id: number; name: string; season: number; number: number; airdate: string; summary: string | null }>>(\`/shows/\${args.show_id}/episodes\`)
  return {
    showId: args.show_id,
    totalEpisodes: data.length,
    episodes: data.slice(0, 50).map((e) => ({
      id: e.id,
      name: e.name,
      season: e.season,
      episode: e.number,
      airdate: e.airdate,
      summary: e.summary?.replace(/<[^>]*>/g, '').slice(0, 200),
    })),
  }
}, { method: 'get_episodes' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  const country = args.country?.toUpperCase().trim() || 'US'
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error('country must be a 2-letter ISO code')
  }
  const dateParam = args.date ? \`&date=\${args.date}\` : ''
  const data = await tvFetch<Array<{ id: number; airdate: string; airtime: string; show: { id: number; name: string }; name: string; season: number; number: number }>>(\`/schedule?country=\${country}\${dateParam}\`)
  return {
    country,
    date: args.date || 'today',
    count: data.length,
    schedule: data.slice(0, 25).map((e) => ({
      showName: e.show.name,
      episodeName: e.name,
      season: e.season,
      episode: e.number,
      airdate: e.airdate,
      airtime: e.airtime,
    })),
  }
}, { method: 'get_schedule' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchShows, getEpisodes, getSchedule }

console.log('settlegrid-tvmaze MCP server ready')
console.log('Methods: search_shows, get_episodes, get_schedule')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 154. Spotify Metadata ──────────────────────────────────────────────────
generateServer({
  slug: 'spotify-metadata',
  name: 'Spotify Metadata',
  description: 'Search tracks, albums, and artists using the Spotify Web API.',
  keywords: ['entertainment', 'music', 'spotify', 'tracks'],
  upstream: { provider: 'Spotify', baseUrl: 'https://api.spotify.com/v1', auth: 'Client credentials (Bearer token)', rateLimit: 'Rate limited per app', docsUrl: 'https://developer.spotify.com/documentation/web-api' },
  auth: { type: 'key', keyEnvVar: 'SPOTIFY_CLIENT_ID', keyDesc: 'Spotify Client ID + SPOTIFY_CLIENT_SECRET' },
  methods: [
    { name: 'search_tracks', displayName: 'Search Tracks', costCents: 2, description: 'Search for tracks by name', params: [{ name: 'query', type: 'string', required: true, description: 'Track name or search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-10, default 10)' }] },
    { name: 'search_artists', displayName: 'Search Artists', costCents: 2, description: 'Search for artists by name', params: [{ name: 'query', type: 'string', required: true, description: 'Artist name' }] },
    { name: 'get_artist_top_tracks', displayName: 'Artist Top Tracks', costCents: 2, description: 'Get an artist top tracks', params: [{ name: 'artist_id', type: 'string', required: true, description: 'Spotify artist ID' }] },
  ],
  serverTs: `/**
 * settlegrid-spotify-metadata — Spotify Web API MCP Server
 *
 * Methods:
 *   search_tracks(query, limit?)        — Search tracks         (2\u00A2)
 *   search_artists(query)               — Search artists        (2\u00A2)
 *   get_artist_top_tracks(artist_id)    — Artist top tracks     (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTracksInput { query: string; limit?: number }
interface SearchArtistsInput { query: string }
interface TopTracksInput { artist_id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.spotify.com/v1'
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''

let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: \`Basic \${Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64')}\`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(\`Spotify auth failed: \${res.status}\`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Spotify API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spotify-metadata',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_tracks: { costCents: 2, displayName: 'Search Tracks' },
      search_artists: { costCents: 2, displayName: 'Search Artists' },
      get_artist_top_tracks: { costCents: 2, displayName: 'Artist Top Tracks' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTracks = sg.wrap(async (args: SearchTracksInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const limit = Math.min(Math.max(args.limit || 10, 1), 10)
  const q = encodeURIComponent(args.query.trim())
  const data = await spotifyFetch<{ tracks: { items: Array<{ id: string; name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string }; duration_ms: number; preview_url: string | null }> } }>(\`/search?q=\${q}&type=track&limit=\${limit}\`)
  return {
    query: args.query,
    tracks: data.tracks.items.map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => a.name),
      album: t.album.name,
      releaseDate: t.album.release_date,
      durationMs: t.duration_ms,
      previewUrl: t.preview_url,
    })),
  }
}, { method: 'search_tracks' })

const searchArtists = sg.wrap(async (args: SearchArtistsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await spotifyFetch<{ artists: { items: Array<{ id: string; name: string; genres: string[]; popularity: number; followers: { total: number } }> } }>(\`/search?q=\${q}&type=artist&limit=10\`)
  return {
    query: args.query,
    artists: data.artists.items.map((a) => ({
      id: a.id,
      name: a.name,
      genres: a.genres,
      popularity: a.popularity,
      followers: a.followers.total,
    })),
  }
}, { method: 'search_artists' })

const getArtistTopTracks = sg.wrap(async (args: TopTracksInput) => {
  if (!args.artist_id || typeof args.artist_id !== 'string') throw new Error('artist_id is required')
  const data = await spotifyFetch<{ tracks: Array<{ id: string; name: string; album: { name: string }; duration_ms: number; popularity: number }> }>(\`/artists/\${encodeURIComponent(args.artist_id)}/top-tracks?market=US\`)
  return {
    artistId: args.artist_id,
    tracks: data.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      album: t.album.name,
      durationMs: t.duration_ms,
      popularity: t.popularity,
    })),
  }
}, { method: 'get_artist_top_tracks' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTracks, searchArtists, getArtistTopTracks }

console.log('settlegrid-spotify-metadata MCP server ready')
console.log('Methods: search_tracks, search_artists, get_artist_top_tracks')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 155. MusicBrainz ───────────────────────────────────────────────────────
generateServer({
  slug: 'musicbrainz',
  name: 'MusicBrainz',
  description: 'Search artists, releases, and recordings via the MusicBrainz open music encyclopedia.',
  keywords: ['entertainment', 'music', 'metadata', 'musicbrainz'],
  upstream: { provider: 'MusicBrainz', baseUrl: 'https://musicbrainz.org/ws/2', auth: 'None (User-Agent required)', rateLimit: '1 req/sec', docsUrl: 'https://musicbrainz.org/doc/MusicBrainz_API' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_artists', displayName: 'Search Artists', costCents: 1, description: 'Search for music artists', params: [{ name: 'query', type: 'string', required: true, description: 'Artist name to search' }] },
    { name: 'search_releases', displayName: 'Search Releases', costCents: 1, description: 'Search for album/single releases', params: [{ name: 'query', type: 'string', required: true, description: 'Release title to search' }] },
    { name: 'get_artist', displayName: 'Get Artist Details', costCents: 1, description: 'Get artist details by MBID', params: [{ name: 'mbid', type: 'string', required: true, description: 'MusicBrainz artist ID (UUID)' }] },
  ],
  serverTs: `/**
 * settlegrid-musicbrainz — MusicBrainz MCP Server
 *
 * Methods:
 *   search_artists(query)    — Search artists        (1\u00A2)
 *   search_releases(query)   — Search releases       (1\u00A2)
 *   get_artist(mbid)         — Get artist details    (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetArtistInput { mbid: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://musicbrainz.org/ws/2'
const UA = 'settlegrid-musicbrainz/1.0 (contact@settlegrid.ai)'

async function mbFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${BASE}\${path}\${sep}fmt=json\`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`MusicBrainz API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'musicbrainz',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artists: { costCents: 1, displayName: 'Search Artists' },
      search_releases: { costCents: 1, displayName: 'Search Releases' },
      get_artist: { costCents: 1, displayName: 'Get Artist Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtists = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await mbFetch<{ artists: Array<{ id: string; name: string; type: string; country: string; 'life-span': { begin: string; end: string | null } }> }>(\`/artist?query=\${q}&limit=10\`)
  return {
    query: args.query,
    artists: (data.artists || []).map((a) => ({
      mbid: a.id,
      name: a.name,
      type: a.type,
      country: a.country,
      lifeSpan: a['life-span'],
    })),
  }
}, { method: 'search_artists' })

const searchReleases = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await mbFetch<{ releases: Array<{ id: string; title: string; date: string; country: string; 'artist-credit': Array<{ name: string }> }> }>(\`/release?query=\${q}&limit=10\`)
  return {
    query: args.query,
    releases: (data.releases || []).map((r) => ({
      mbid: r.id,
      title: r.title,
      date: r.date,
      country: r.country,
      artists: r['artist-credit']?.map((a) => a.name),
    })),
  }
}, { method: 'search_releases' })

const getArtist = sg.wrap(async (args: GetArtistInput) => {
  if (!args.mbid || typeof args.mbid !== 'string') throw new Error('mbid is required')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.mbid)) {
    throw new Error('mbid must be a valid UUID')
  }
  const data = await mbFetch<{ id: string; name: string; type: string; country: string; 'life-span': { begin: string; end: string | null; ended: boolean }; 'begin-area': { name: string } }>(\`/artist/\${args.mbid}?inc=url-rels\`)
  return {
    mbid: data.id,
    name: data.name,
    type: data.type,
    country: data.country,
    lifeSpan: data['life-span'],
    beginArea: data['begin-area']?.name,
  }
}, { method: 'get_artist' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtists, searchReleases, getArtist }

console.log('settlegrid-musicbrainz MCP server ready')
console.log('Methods: search_artists, search_releases, get_artist')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 156. IGDB ──────────────────────────────────────────────────────────────
generateServer({
  slug: 'igdb',
  name: 'IGDB (Internet Game Database)',
  description: 'Search video games, get details and reviews from IGDB (Twitch-owned).',
  keywords: ['entertainment', 'games', 'video-games', 'igdb'],
  upstream: { provider: 'IGDB / Twitch', baseUrl: 'https://api.igdb.com/v4', auth: 'Twitch Client ID + Bearer token', rateLimit: '4 req/sec', docsUrl: 'https://api-docs.igdb.com/' },
  auth: { type: 'key', keyEnvVar: 'TWITCH_CLIENT_ID', keyDesc: 'Twitch Client ID + TWITCH_CLIENT_SECRET for IGDB access' },
  methods: [
    { name: 'search_games', displayName: 'Search Games', costCents: 2, description: 'Search video games by name', params: [{ name: 'query', type: 'string', required: true, description: 'Game title to search' }] },
    { name: 'get_game', displayName: 'Get Game Details', costCents: 2, description: 'Get detailed game info by ID', params: [{ name: 'game_id', type: 'number', required: true, description: 'IGDB game ID' }] },
  ],
  serverTs: `/**
 * settlegrid-igdb — IGDB Video Game MCP Server
 *
 * Methods:
 *   search_games(query)    — Search games     (2\u00A2)
 *   get_game(game_id)      — Game details     (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetGameInput { game_id: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.igdb.com/v4'
const CLIENT_ID = process.env.TWITCH_CLIENT_ID || ''
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || ''

let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required')
  const res = await fetch(\`https://id.twitch.tv/oauth2/token?client_id=\${CLIENT_ID}&client_secret=\${CLIENT_SECRET}&grant_type=client_credentials\`, { method: 'POST' })
  if (!res.ok) throw new Error(\`Twitch auth failed: \${res.status}\`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function igdbFetch<T>(endpoint: string, body: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(\`\${BASE}/\${endpoint}\`, {
    method: 'POST',
    headers: { 'Client-ID': CLIENT_ID, Authorization: \`Bearer \${token}\`, 'Content-Type': 'text/plain' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`IGDB API \${res.status}: \${text.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'igdb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_games: { costCents: 2, displayName: 'Search Games' },
      get_game: { costCents: 2, displayName: 'Get Game Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGames = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await igdbFetch<Array<{ id: number; name: string; summary: string; rating: number; first_release_date: number; genres: Array<{ name: string }> }>>('games', \`search "\${args.query.replace(/"/g, '')}"; fields name,summary,rating,first_release_date,genres.name; limit 10;\`)
  return {
    query: args.query,
    games: data.map((g) => ({
      id: g.id,
      name: g.name,
      summary: g.summary?.slice(0, 300),
      rating: g.rating ? Math.round(g.rating * 10) / 10 : null,
      releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().split('T')[0] : null,
      genres: g.genres?.map((ge) => ge.name),
    })),
  }
}, { method: 'search_games' })

const getGame = sg.wrap(async (args: GetGameInput) => {
  if (typeof args.game_id !== 'number' || args.game_id <= 0) throw new Error('game_id must be a positive number')
  const data = await igdbFetch<Array<{ id: number; name: string; summary: string; storyline: string; rating: number; aggregated_rating: number; first_release_date: number; genres: Array<{ name: string }>; platforms: Array<{ name: string }> }>>('games', \`where id = \${args.game_id}; fields name,summary,storyline,rating,aggregated_rating,first_release_date,genres.name,platforms.name;\`)
  if (!data.length) throw new Error(\`Game not found: \${args.game_id}\`)
  const g = data[0]
  return {
    id: g.id,
    name: g.name,
    summary: g.summary,
    storyline: g.storyline?.slice(0, 500),
    userRating: g.rating ? Math.round(g.rating * 10) / 10 : null,
    criticRating: g.aggregated_rating ? Math.round(g.aggregated_rating * 10) / 10 : null,
    releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().split('T')[0] : null,
    genres: g.genres?.map((ge) => ge.name),
    platforms: g.platforms?.map((p) => p.name),
  }
}, { method: 'get_game' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getGame }

console.log('settlegrid-igdb MCP server ready')
console.log('Methods: search_games, get_game')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 157. RAWG ──────────────────────────────────────────────────────────────
generateServer({
  slug: 'rawg',
  name: 'RAWG Video Games Database',
  description: 'Search and explore 500,000+ video games from the RAWG database.',
  keywords: ['entertainment', 'games', 'video-games', 'rawg'],
  upstream: { provider: 'RAWG', baseUrl: 'https://api.rawg.io/api', auth: 'API key (query param)', rateLimit: '20,000/mo free', docsUrl: 'https://rawg.io/apidocs' },
  auth: { type: 'key', keyEnvVar: 'RAWG_API_KEY', keyDesc: 'RAWG API key (free at rawg.io)' },
  methods: [
    { name: 'search_games', displayName: 'Search Games', costCents: 2, description: 'Search video games', params: [{ name: 'query', type: 'string', required: true, description: 'Game title to search' }] },
    { name: 'get_game', displayName: 'Get Game', costCents: 2, description: 'Get game details by slug or ID', params: [{ name: 'id', type: 'string', required: true, description: 'Game ID or slug' }] },
    { name: 'get_genres', displayName: 'Get Genres', costCents: 1, description: 'List all game genres', params: [] },
  ],
  serverTs: `/**
 * settlegrid-rawg — RAWG Video Games MCP Server
 *
 * Methods:
 *   search_games(query)  — Search games      (2\u00A2)
 *   get_game(id)         — Game details      (2\u00A2)
 *   get_genres()         — List genres       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetGameInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.rawg.io/api'
const API_KEY = process.env.RAWG_API_KEY || ''

async function rawgFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('RAWG_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${BASE}\${path}\${sep}key=\${API_KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`RAWG API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rawg',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_games: { costCents: 2, displayName: 'Search Games' },
      get_game: { costCents: 2, displayName: 'Get Game' },
      get_genres: { costCents: 1, displayName: 'Get Genres' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGames = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await rawgFetch<{ count: number; results: Array<{ id: number; slug: string; name: string; released: string; rating: number; metacritic: number; genres: Array<{ name: string }>; platforms: Array<{ platform: { name: string } }> }> }>(\`/games?search=\${q}&page_size=10\`)
  return {
    query: args.query,
    count: data.count,
    games: data.results.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      released: g.released,
      rating: g.rating,
      metacritic: g.metacritic,
      genres: g.genres?.map((ge) => ge.name),
      platforms: g.platforms?.map((p) => p.platform.name),
    })),
  }
}, { method: 'search_games' })

const getGame = sg.wrap(async (args: GetGameInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required (game ID or slug)')
  const data = await rawgFetch<{ id: number; slug: string; name: string; description_raw: string; released: string; rating: number; metacritic: number; playtime: number; genres: Array<{ name: string }>; platforms: Array<{ platform: { name: string } }>; developers: Array<{ name: string }>; publishers: Array<{ name: string }> }>(\`/games/\${encodeURIComponent(args.id)}\`)
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description_raw?.slice(0, 500),
    released: data.released,
    rating: data.rating,
    metacritic: data.metacritic,
    playtime: data.playtime,
    genres: data.genres?.map((g) => g.name),
    platforms: data.platforms?.map((p) => p.platform.name),
    developers: data.developers?.map((d) => d.name),
    publishers: data.publishers?.map((p) => p.name),
  }
}, { method: 'get_game' })

const getGenres = sg.wrap(async () => {
  const data = await rawgFetch<{ results: Array<{ id: number; name: string; slug: string; games_count: number }> }>('/genres')
  return { genres: data.results.map((g) => ({ id: g.id, name: g.name, slug: g.slug, gamesCount: g.games_count })) }
}, { method: 'get_genres' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getGame, getGenres }

console.log('settlegrid-rawg MCP server ready')
console.log('Methods: search_games, get_game, get_genres')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 158. Board Game Atlas ──────────────────────────────────────────────────
generateServer({
  slug: 'boardgame-atlas',
  name: 'Board Game Atlas',
  description: 'Search and explore board games, mechanics, and categories from Board Game Atlas.',
  keywords: ['entertainment', 'board-games', 'tabletop'],
  upstream: { provider: 'Board Game Atlas', baseUrl: 'https://api.boardgameatlas.com/api', auth: 'Client ID (query param)', rateLimit: 'Reasonable use', docsUrl: 'https://www.boardgameatlas.com/api/docs' },
  auth: { type: 'key', keyEnvVar: 'BGA_CLIENT_ID', keyDesc: 'Board Game Atlas client ID (free at boardgameatlas.com)' },
  methods: [
    { name: 'search_games', displayName: 'Search Board Games', costCents: 2, description: 'Search board games by name', params: [{ name: 'query', type: 'string', required: true, description: 'Board game name' }] },
    { name: 'get_mechanics', displayName: 'Get Mechanics', costCents: 1, description: 'List game mechanics', params: [] },
  ],
  serverTs: `/**
 * settlegrid-boardgame-atlas — Board Game Atlas MCP Server
 *
 * Methods:
 *   search_games(query)  — Search board games    (2\u00A2)
 *   get_mechanics()      — List mechanics        (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.boardgameatlas.com/api'
const CLIENT_ID = process.env.BGA_CLIENT_ID || ''

async function bgaFetch<T>(path: string): Promise<T> {
  if (!CLIENT_ID) throw new Error('BGA_CLIENT_ID environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${BASE}\${path}\${sep}client_id=\${CLIENT_ID}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Board Game Atlas API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'boardgame-atlas',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_games: { costCents: 2, displayName: 'Search Board Games' },
      get_mechanics: { costCents: 1, displayName: 'Get Mechanics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGames = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await bgaFetch<{ games: Array<{ id: string; name: string; year_published: number; min_players: number; max_players: number; min_playtime: number; max_playtime: number; average_user_rating: number; description_preview: string; image_url: string }> }>(\`/search?name=\${q}&limit=10\`)
  return {
    query: args.query,
    count: data.games?.length || 0,
    games: (data.games || []).map((g) => ({
      id: g.id,
      name: g.name,
      yearPublished: g.year_published,
      players: \`\${g.min_players}-\${g.max_players}\`,
      playtime: \`\${g.min_playtime}-\${g.max_playtime} min\`,
      rating: g.average_user_rating ? Math.round(g.average_user_rating * 100) / 100 : null,
      description: g.description_preview?.slice(0, 300),
      image: g.image_url,
    })),
  }
}, { method: 'search_games' })

const getMechanics = sg.wrap(async () => {
  const data = await bgaFetch<{ mechanics: Array<{ id: string; name: string }> }>('/game/mechanics')
  return { mechanics: data.mechanics || [] }
}, { method: 'get_mechanics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getMechanics }

console.log('settlegrid-boardgame-atlas MCP server ready')
console.log('Methods: search_games, get_mechanics')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 159. Open Trivia DB ────────────────────────────────────────────────────
generateServer({
  slug: 'opentdb',
  name: 'Open Trivia Database',
  description: 'Get trivia questions across categories from the Open Trivia Database.',
  keywords: ['entertainment', 'trivia', 'quiz', 'questions'],
  upstream: { provider: 'Open Trivia DB', baseUrl: 'https://opentdb.com', auth: 'None required', rateLimit: '1 req/5s', docsUrl: 'https://opentdb.com/api_config.php' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_questions', displayName: 'Get Questions', costCents: 1, description: 'Get trivia questions', params: [{ name: 'amount', type: 'number', required: false, description: 'Number of questions (1-50, default 10)' }, { name: 'category', type: 'number', required: false, description: 'Category ID (9-32)' }, { name: 'difficulty', type: 'string', required: false, description: '"easy", "medium", or "hard"' }] },
    { name: 'get_categories', displayName: 'Get Categories', costCents: 1, description: 'List all trivia categories', params: [] },
  ],
  serverTs: `/**
 * settlegrid-opentdb — Open Trivia Database MCP Server
 *
 * Methods:
 *   get_questions(amount?, category?, difficulty?)  — Get trivia questions  (1\u00A2)
 *   get_categories()                                — List categories       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuestionsInput {
  amount?: number
  category?: number
  difficulty?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://opentdb.com'

async function triviaFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenTDB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function decodeHtml(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'opentdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_questions: { costCents: 1, displayName: 'Get Questions' },
      get_categories: { costCents: 1, displayName: 'Get Categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuestions = sg.wrap(async (args: QuestionsInput) => {
  const amount = Math.min(Math.max(args.amount || 10, 1), 50)
  let url = \`/api.php?amount=\${amount}\`
  if (args.category && args.category >= 9 && args.category <= 32) {
    url += \`&category=\${args.category}\`
  }
  const validDiffs = ['easy', 'medium', 'hard']
  if (args.difficulty && validDiffs.includes(args.difficulty)) {
    url += \`&difficulty=\${args.difficulty}\`
  }
  const data = await triviaFetch<{ response_code: number; results: Array<{ category: string; type: string; difficulty: string; question: string; correct_answer: string; incorrect_answers: string[] }> }>(url)
  if (data.response_code !== 0) throw new Error(\`OpenTDB response code: \${data.response_code}\`)
  return {
    count: data.results.length,
    questions: data.results.map((q) => ({
      category: decodeHtml(q.category),
      difficulty: q.difficulty,
      type: q.type,
      question: decodeHtml(q.question),
      correctAnswer: decodeHtml(q.correct_answer),
      incorrectAnswers: q.incorrect_answers.map(decodeHtml),
    })),
  }
}, { method: 'get_questions' })

const getCategories = sg.wrap(async () => {
  const data = await triviaFetch<{ trivia_categories: Array<{ id: number; name: string }> }>('/api_category.php')
  return { categories: data.trivia_categories }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuestions, getCategories }

console.log('settlegrid-opentdb MCP server ready')
console.log('Methods: get_questions, get_categories')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 160. JService ──────────────────────────────────────────────────────────
generateServer({
  slug: 'jservice',
  name: 'JService (Jeopardy)',
  description: 'Access Jeopardy trivia clues, categories, and random questions from JService.',
  keywords: ['entertainment', 'trivia', 'jeopardy', 'quiz'],
  upstream: { provider: 'JService', baseUrl: 'https://jservice.io/api', auth: 'None required', rateLimit: 'Unlimited', docsUrl: 'https://jservice.io/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_random', displayName: 'Random Clues', costCents: 1, description: 'Get random Jeopardy clues', params: [{ name: 'count', type: 'number', required: false, description: 'Number of clues (1-100, default 5)' }] },
    { name: 'get_categories', displayName: 'Get Categories', costCents: 1, description: 'List Jeopardy categories', params: [{ name: 'count', type: 'number', required: false, description: 'Number of categories (default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-jservice — JService Jeopardy MCP Server
 *
 * Methods:
 *   get_random(count?)       — Random Jeopardy clues    (1\u00A2)
 *   get_categories(count?)   — List categories           (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput { count?: number }
interface CategoriesInput { count?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://jservice.io/api'

async function jFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`JService API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'jservice',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Random Clues' },
      get_categories: { costCents: 1, displayName: 'Get Categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: RandomInput) => {
  const count = Math.min(Math.max(args.count || 5, 1), 100)
  const data = await jFetch<Array<{ id: number; question: string; answer: string; value: number; category: { id: number; title: string }; airdate: string }>>(\`/random?count=\${count}\`)
  return {
    count: data.length,
    clues: data.map((c) => ({
      id: c.id,
      question: c.question,
      answer: c.answer?.replace(/<[^>]*>/g, ''),
      value: c.value,
      category: c.category?.title,
      airdate: c.airdate,
    })),
  }
}, { method: 'get_random' })

const getCategories = sg.wrap(async (args: CategoriesInput) => {
  const count = Math.min(Math.max(args.count || 10, 1), 100)
  const data = await jFetch<Array<{ id: number; title: string; clues_count: number }>>(\`/categories?count=\${count}\`)
  return {
    categories: data.map((c) => ({
      id: c.id,
      title: c.title,
      cluesCount: c.clues_count,
    })),
  }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, getCategories }

console.log('settlegrid-jservice MCP server ready')
console.log('Methods: get_random, get_categories')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 161. Chuck Norris Jokes ────────────────────────────────────────────────
generateServer({
  slug: 'chuck-norris',
  name: 'Chuck Norris Jokes',
  description: 'Get random Chuck Norris jokes and search by keyword from the Chuck Norris API.',
  keywords: ['entertainment', 'jokes', 'humor', 'chuck-norris'],
  upstream: { provider: 'Chuck Norris API', baseUrl: 'https://api.chucknorris.io', auth: 'None required', rateLimit: 'Unlimited', docsUrl: 'https://api.chucknorris.io/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_random', displayName: 'Random Joke', costCents: 1, description: 'Get a random Chuck Norris joke', params: [{ name: 'category', type: 'string', required: false, description: 'Joke category (e.g. "dev", "science")' }] },
    { name: 'search_jokes', displayName: 'Search Jokes', costCents: 1, description: 'Search jokes by keyword', params: [{ name: 'query', type: 'string', required: true, description: 'Search keyword' }] },
    { name: 'get_categories', displayName: 'Get Categories', costCents: 1, description: 'List all joke categories', params: [] },
  ],
  serverTs: `/**
 * settlegrid-chuck-norris — Chuck Norris Jokes MCP Server
 *
 * Methods:
 *   get_random(category?)   — Random joke        (1\u00A2)
 *   search_jokes(query)     — Search jokes       (1\u00A2)
 *   get_categories()        — List categories    (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput { category?: string }
interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.chucknorris.io'

async function cnFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Chuck Norris API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chuck-norris',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Random Joke' },
      search_jokes: { costCents: 1, displayName: 'Search Jokes' },
      get_categories: { costCents: 1, displayName: 'Get Categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: RandomInput) => {
  const catParam = args.category ? \`?category=\${encodeURIComponent(args.category)}\` : ''
  const data = await cnFetch<{ id: string; value: string; categories: string[]; url: string }>(\`/jokes/random\${catParam}\`)
  return { id: data.id, joke: data.value, categories: data.categories, url: data.url }
}, { method: 'get_random' })

const searchJokes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  if (args.query.trim().length < 3) throw new Error('query must be at least 3 characters')
  const q = encodeURIComponent(args.query.trim())
  const data = await cnFetch<{ total: number; result: Array<{ id: string; value: string; categories: string[] }> }>(\`/jokes/search?query=\${q}\`)
  return {
    query: args.query,
    total: data.total,
    jokes: data.result.slice(0, 10).map((j) => ({
      id: j.id,
      joke: j.value,
      categories: j.categories,
    })),
  }
}, { method: 'search_jokes' })

const getCategories = sg.wrap(async () => {
  const data = await cnFetch<string[]>('/jokes/categories')
  return { categories: data }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchJokes, getCategories }

console.log('settlegrid-chuck-norris MCP server ready')
console.log('Methods: get_random, search_jokes, get_categories')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 162. Dad Jokes ─────────────────────────────────────────────────────────
generateServer({
  slug: 'dad-jokes',
  name: 'Dad Jokes',
  description: 'Get random dad jokes and search the dad joke database.',
  keywords: ['entertainment', 'jokes', 'humor', 'dad-jokes'],
  upstream: { provider: 'icanhazdadjoke', baseUrl: 'https://icanhazdadjoke.com', auth: 'None required', rateLimit: '100 req/min', docsUrl: 'https://icanhazdadjoke.com/api' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_random', displayName: 'Random Dad Joke', costCents: 1, description: 'Get a random dad joke', params: [] },
    { name: 'search_jokes', displayName: 'Search Jokes', costCents: 1, description: 'Search dad jokes by keyword', params: [{ name: 'query', type: 'string', required: true, description: 'Search term' }] },
  ],
  serverTs: `/**
 * settlegrid-dad-jokes — Dad Jokes MCP Server
 *
 * Methods:
 *   get_random()           — Random dad joke     (1\u00A2)
 *   search_jokes(query)    — Search jokes        (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://icanhazdadjoke.com'

async function dadFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-dad-jokes/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Dad Jokes API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dad-jokes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Random Dad Joke' },
      search_jokes: { costCents: 1, displayName: 'Search Jokes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async () => {
  const data = await dadFetch<{ id: string; joke: string }>('/')
  return { id: data.id, joke: data.joke }
}, { method: 'get_random' })

const searchJokes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await dadFetch<{ results: Array<{ id: string; joke: string }>; total_jokes: number }>(\`/search?term=\${q}&limit=10\`)
  return {
    query: args.query,
    total: data.total_jokes,
    jokes: data.results.map((j) => ({ id: j.id, joke: j.joke })),
  }
}, { method: 'search_jokes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchJokes }

console.log('settlegrid-dad-jokes MCP server ready')
console.log('Methods: get_random, search_jokes')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 163. Cat Facts ─────────────────────────────────────────────────────────
generateServer({
  slug: 'catfact',
  name: 'Cat Facts',
  description: 'Get random cat facts and browse the cat facts database.',
  keywords: ['entertainment', 'cats', 'facts', 'animals'],
  upstream: { provider: 'Cat Fact Ninja', baseUrl: 'https://catfact.ninja', auth: 'None required', rateLimit: 'Unlimited', docsUrl: 'https://catfact.ninja/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_fact', displayName: 'Random Cat Fact', costCents: 1, description: 'Get a random cat fact', params: [] },
    { name: 'get_facts', displayName: 'Cat Facts List', costCents: 1, description: 'Get a list of cat facts', params: [{ name: 'limit', type: 'number', required: false, description: 'Number of facts (1-50, default 10)' }] },
    { name: 'get_breeds', displayName: 'Cat Breeds', costCents: 1, description: 'List cat breeds', params: [{ name: 'limit', type: 'number', required: false, description: 'Number of breeds (default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-catfact — Cat Facts MCP Server
 *
 * Methods:
 *   get_fact()            — Random cat fact    (1\u00A2)
 *   get_facts(limit?)     — List cat facts     (1\u00A2)
 *   get_breeds(limit?)    — List cat breeds    (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput { limit?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://catfact.ninja'

async function catFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Cat Fact API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'catfact',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_fact: { costCents: 1, displayName: 'Random Cat Fact' },
      get_facts: { costCents: 1, displayName: 'Cat Facts List' },
      get_breeds: { costCents: 1, displayName: 'Cat Breeds' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFact = sg.wrap(async () => {
  const data = await catFetch<{ fact: string; length: number }>('/fact')
  return { fact: data.fact, length: data.length }
}, { method: 'get_fact' })

const getFacts = sg.wrap(async (args: ListInput) => {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)
  const data = await catFetch<{ data: Array<{ fact: string; length: number }> }>(\`/facts?limit=\${limit}\`)
  return { count: data.data.length, facts: data.data }
}, { method: 'get_facts' })

const getBreeds = sg.wrap(async (args: ListInput) => {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)
  const data = await catFetch<{ data: Array<{ breed: string; country: string; origin: string; coat: string; pattern: string }> }>(\`/breeds?limit=\${limit}\`)
  return { count: data.data.length, breeds: data.data }
}, { method: 'get_breeds' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFact, getFacts, getBreeds }

console.log('settlegrid-catfact MCP server ready')
console.log('Methods: get_fact, get_facts, get_breeds')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 164. Dog CEO ───────────────────────────────────────────────────────────
generateServer({
  slug: 'dog-ceo',
  name: 'Dog CEO',
  description: 'Get random dog images and browse breeds from the Dog CEO API.',
  keywords: ['entertainment', 'dogs', 'images', 'animals'],
  upstream: { provider: 'Dog CEO', baseUrl: 'https://dog.ceo/api', auth: 'None required', rateLimit: 'Unlimited', docsUrl: 'https://dog.ceo/dog-api/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_random_image', displayName: 'Random Dog Image', costCents: 1, description: 'Get a random dog image URL', params: [{ name: 'count', type: 'number', required: false, description: 'Number of images (1-50, default 1)' }] },
    { name: 'get_breed_image', displayName: 'Breed Image', costCents: 1, description: 'Get a random image of a specific breed', params: [{ name: 'breed', type: 'string', required: true, description: 'Dog breed (e.g. "labrador", "poodle")' }] },
    { name: 'list_breeds', displayName: 'List Breeds', costCents: 1, description: 'List all dog breeds', params: [] },
  ],
  serverTs: `/**
 * settlegrid-dog-ceo — Dog CEO MCP Server
 *
 * Methods:
 *   get_random_image(count?)   — Random dog image(s)    (1\u00A2)
 *   get_breed_image(breed)     — Breed-specific image   (1\u00A2)
 *   list_breeds()              — List all breeds        (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput { count?: number }
interface BreedInput { breed: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://dog.ceo/api'

async function dogFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Dog CEO API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json() as T & { status?: string }
  if (data.status === 'error') throw new Error('Dog breed not found')
  return data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dog-ceo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random_image: { costCents: 1, displayName: 'Random Dog Image' },
      get_breed_image: { costCents: 1, displayName: 'Breed Image' },
      list_breeds: { costCents: 1, displayName: 'List Breeds' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandomImage = sg.wrap(async (args: RandomInput) => {
  if (args.count && args.count > 1) {
    const count = Math.min(Math.max(args.count, 1), 50)
    const data = await dogFetch<{ message: string[] }>(\`/breeds/image/random/\${count}\`)
    return { count: data.message.length, images: data.message }
  }
  const data = await dogFetch<{ message: string }>('/breeds/image/random')
  return { image: data.message }
}, { method: 'get_random_image' })

const getBreedImage = sg.wrap(async (args: BreedInput) => {
  if (!args.breed || typeof args.breed !== 'string') throw new Error('breed is required')
  const breed = args.breed.toLowerCase().trim().replace(/\\s+/g, '/')
  if (!/^[a-z]+(\/[a-z]+)?$/.test(breed)) throw new Error('Invalid breed name')
  const data = await dogFetch<{ message: string }>(\`/breed/\${breed}/images/random\`)
  return { breed: args.breed, image: data.message }
}, { method: 'get_breed_image' })

const listBreeds = sg.wrap(async () => {
  const data = await dogFetch<{ message: Record<string, string[]> }>('/breeds/list/all')
  const breeds = Object.entries(data.message).map(([breed, subBreeds]) => ({
    breed,
    subBreeds: subBreeds.length > 0 ? subBreeds : undefined,
  }))
  return { count: breeds.length, breeds }
}, { method: 'list_breeds' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandomImage, getBreedImage, listBreeds }

console.log('settlegrid-dog-ceo MCP server ready')
console.log('Methods: get_random_image, get_breed_image, list_breeds')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 165. PokeAPI — SKIP (already exists) ───────────────────────────────────
console.log('  - settlegrid-pokeapi (SKIP — already exists)')

// ─── 166. SWAPI ─────────────────────────────────────────────────────────────
generateServer({
  slug: 'swapi',
  name: 'SWAPI (Star Wars API)',
  description: 'Access Star Wars universe data: people, planets, starships, and films from SWAPI.',
  keywords: ['entertainment', 'star-wars', 'movies', 'swapi'],
  upstream: { provider: 'SWAPI', baseUrl: 'https://swapi.dev/api', auth: 'None required', rateLimit: '10,000/day', docsUrl: 'https://swapi.dev/documentation' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_people', displayName: 'Search People', costCents: 1, description: 'Search Star Wars characters', params: [{ name: 'query', type: 'string', required: true, description: 'Character name' }] },
    { name: 'search_planets', displayName: 'Search Planets', costCents: 1, description: 'Search Star Wars planets', params: [{ name: 'query', type: 'string', required: true, description: 'Planet name' }] },
    { name: 'get_film', displayName: 'Get Film', costCents: 1, description: 'Get Star Wars film details by episode number', params: [{ name: 'episode', type: 'number', required: true, description: 'Episode number (1-6)' }] },
  ],
  serverTs: `/**
 * settlegrid-swapi — Star Wars API MCP Server
 *
 * Methods:
 *   search_people(query)    — Search characters    (1\u00A2)
 *   search_planets(query)   — Search planets       (1\u00A2)
 *   get_film(episode)       — Get film details     (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface FilmInput { episode: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://swapi.dev/api'

async function swapiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SWAPI \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'swapi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_people: { costCents: 1, displayName: 'Search People' },
      search_planets: { costCents: 1, displayName: 'Search Planets' },
      get_film: { costCents: 1, displayName: 'Get Film' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPeople = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await swapiFetch<{ count: number; results: Array<{ name: string; height: string; mass: string; hair_color: string; birth_year: string; gender: string; homeworld: string }> }>(\`/people/?search=\${q}\`)
  return {
    query: args.query,
    count: data.count,
    people: data.results.map((p) => ({
      name: p.name,
      height: p.height,
      mass: p.mass,
      hairColor: p.hair_color,
      birthYear: p.birth_year,
      gender: p.gender,
    })),
  }
}, { method: 'search_people' })

const searchPlanets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await swapiFetch<{ count: number; results: Array<{ name: string; climate: string; terrain: string; population: string; diameter: string; gravity: string }> }>(\`/planets/?search=\${q}\`)
  return {
    query: args.query,
    count: data.count,
    planets: data.results.map((p) => ({
      name: p.name,
      climate: p.climate,
      terrain: p.terrain,
      population: p.population,
      diameter: p.diameter,
      gravity: p.gravity,
    })),
  }
}, { method: 'search_planets' })

const getFilm = sg.wrap(async (args: FilmInput) => {
  if (typeof args.episode !== 'number' || args.episode < 1 || args.episode > 6) {
    throw new Error('episode must be 1-6')
  }
  const data = await swapiFetch<{ results: Array<{ title: string; episode_id: number; opening_crawl: string; director: string; producer: string; release_date: string }> }>('/films/')
  const film = data.results.find((f) => f.episode_id === args.episode)
  if (!film) throw new Error(\`Film not found for episode \${args.episode}\`)
  return {
    title: film.title,
    episode: film.episode_id,
    openingCrawl: film.opening_crawl?.slice(0, 500),
    director: film.director,
    producer: film.producer,
    releaseDate: film.release_date,
  }
}, { method: 'get_film' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPeople, searchPlanets, getFilm }

console.log('settlegrid-swapi MCP server ready')
console.log('Methods: search_people, search_planets, get_film')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 167. Superhero API ─────────────────────────────────────────────────────
generateServer({
  slug: 'superhero',
  name: 'Superhero API',
  description: 'Look up superhero stats, powers, and biographies from the Superhero API.',
  keywords: ['entertainment', 'superheroes', 'comics', 'marvel', 'dc'],
  upstream: { provider: 'Akabab Superhero API', baseUrl: 'https://akabab.github.io/superhero-api/api', auth: 'None required', rateLimit: 'Unlimited (static CDN)', docsUrl: 'https://akabab.github.io/superhero-api/' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_heroes', displayName: 'Search Heroes', costCents: 1, description: 'Search superheroes by name', params: [{ name: 'query', type: 'string', required: true, description: 'Hero name' }] },
    { name: 'get_hero', displayName: 'Get Hero', costCents: 1, description: 'Get hero details by ID', params: [{ name: 'id', type: 'number', required: true, description: 'Superhero ID' }] },
  ],
  serverTs: `/**
 * settlegrid-superhero — Superhero API MCP Server
 *
 * Methods:
 *   search_heroes(query)  — Search heroes     (1\u00A2)
 *   get_hero(id)          — Get hero details  (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetHeroInput { id: number }

interface Hero {
  id: number
  name: string
  slug: string
  powerstats: { intelligence: number; strength: number; speed: number; durability: number; power: number; combat: number }
  appearance: { gender: string; race: string; height: string[]; weight: string[] }
  biography: { fullName: string; publisher: string; alignment: string; firstAppearance: string }
  images: { sm: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://akabab.github.io/superhero-api/api'
let heroCache: Hero[] | null = null

async function getAllHeroes(): Promise<Hero[]> {
  if (heroCache) return heroCache
  const res = await fetch(\`\${BASE}/all.json\`)
  if (!res.ok) throw new Error(\`Superhero API \${res.status}\`)
  heroCache = await res.json() as Hero[]
  return heroCache
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'superhero',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_heroes: { costCents: 1, displayName: 'Search Heroes' },
      get_hero: { costCents: 1, displayName: 'Get Hero' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchHeroes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = args.query.toLowerCase().trim()
  const all = await getAllHeroes()
  const matches = all.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 10)
  return {
    query: args.query,
    count: matches.length,
    heroes: matches.map((h) => ({
      id: h.id,
      name: h.name,
      publisher: h.biography?.publisher,
      alignment: h.biography?.alignment,
      powerstats: h.powerstats,
    })),
  }
}, { method: 'search_heroes' })

const getHero = sg.wrap(async (args: GetHeroInput) => {
  if (typeof args.id !== 'number' || args.id <= 0) throw new Error('id must be a positive number')
  const res = await fetch(\`\${BASE}/id/\${args.id}.json\`)
  if (!res.ok) throw new Error(\`Hero not found: \${args.id}\`)
  const h = await res.json() as Hero
  return {
    id: h.id,
    name: h.name,
    powerstats: h.powerstats,
    appearance: h.appearance,
    biography: h.biography,
    image: h.images?.sm,
  }
}, { method: 'get_hero' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchHeroes, getHero }

console.log('settlegrid-superhero MCP server ready')
console.log('Methods: search_heroes, get_hero')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 168. Harry Potter ──────────────────────────────────────────────────────
generateServer({
  slug: 'harry-potter',
  name: 'Harry Potter API',
  description: 'Access Harry Potter characters, spells, and house data.',
  keywords: ['entertainment', 'harry-potter', 'movies', 'books'],
  upstream: { provider: 'HP API', baseUrl: 'https://hp-api.onrender.com/api', auth: 'None required', rateLimit: 'Unlimited', docsUrl: 'https://hp-api.onrender.com/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_characters', displayName: 'Get Characters', costCents: 1, description: 'Get all Harry Potter characters', params: [{ name: 'house', type: 'string', required: false, description: 'Filter by house: gryffindor, slytherin, hufflepuff, ravenclaw' }] },
    { name: 'get_character', displayName: 'Get Character', costCents: 1, description: 'Get a specific character by ID', params: [{ name: 'id', type: 'string', required: true, description: 'Character ID' }] },
    { name: 'get_spells', displayName: 'Get Spells', costCents: 1, description: 'Get all Harry Potter spells', params: [] },
  ],
  serverTs: `/**
 * settlegrid-harry-potter — Harry Potter API MCP Server
 *
 * Methods:
 *   get_characters(house?)   — Get characters      (1\u00A2)
 *   get_character(id)        — Get character by ID  (1\u00A2)
 *   get_spells()             — Get all spells       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CharactersInput { house?: string }
interface CharacterInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://hp-api.onrender.com/api'

async function hpFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`HP API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const VALID_HOUSES = new Set(['gryffindor', 'slytherin', 'hufflepuff', 'ravenclaw'])

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'harry-potter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_characters: { costCents: 1, displayName: 'Get Characters' },
      get_character: { costCents: 1, displayName: 'Get Character' },
      get_spells: { costCents: 1, displayName: 'Get Spells' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCharacters = sg.wrap(async (args: CharactersInput) => {
  let path = '/characters'
  if (args.house) {
    const house = args.house.toLowerCase().trim()
    if (!VALID_HOUSES.has(house)) throw new Error(\`house must be one of: \${[...VALID_HOUSES].join(', ')}\`)
    path = \`/characters/house/\${house}\`
  }
  const data = await hpFetch<Array<{ id: string; name: string; house: string; species: string; actor: string; patronus: string; alive: boolean }>>(path)
  return {
    count: data.length,
    characters: data.slice(0, 25).map((c) => ({
      id: c.id,
      name: c.name,
      house: c.house,
      species: c.species,
      actor: c.actor,
      patronus: c.patronus,
      alive: c.alive,
    })),
  }
}, { method: 'get_characters' })

const getCharacter = sg.wrap(async (args: CharacterInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const data = await hpFetch<Array<{ id: string; name: string; house: string; species: string; gender: string; dateOfBirth: string; actor: string; patronus: string; wand: { wood: string; core: string; length: number }; alive: boolean }>>(\`/character/\${encodeURIComponent(args.id)}\`)
  if (!data.length) throw new Error(\`Character not found: \${args.id}\`)
  const c = data[0]
  return {
    id: c.id,
    name: c.name,
    house: c.house,
    species: c.species,
    gender: c.gender,
    dateOfBirth: c.dateOfBirth,
    actor: c.actor,
    patronus: c.patronus,
    wand: c.wand,
    alive: c.alive,
  }
}, { method: 'get_character' })

const getSpells = sg.wrap(async () => {
  const data = await hpFetch<Array<{ id: string; name: string; description: string }>>('/spells')
  return { count: data.length, spells: data.map((s) => ({ id: s.id, name: s.name, description: s.description })) }
}, { method: 'get_spells' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCharacters, getCharacter, getSpells }

console.log('settlegrid-harry-potter MCP server ready')
console.log('Methods: get_characters, get_character, get_spells')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 169. Anime (Jikan) ────────────────────────────────────────────────────
generateServer({
  slug: 'anime',
  name: 'Anime & Manga (Jikan)',
  description: 'Search anime, manga, and character data via the Jikan/MyAnimeList API.',
  keywords: ['entertainment', 'anime', 'manga', 'jikan'],
  upstream: { provider: 'Jikan (MyAnimeList)', baseUrl: 'https://api.jikan.moe/v4', auth: 'None required', rateLimit: '3 req/sec', docsUrl: 'https://docs.api.jikan.moe/' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_anime', displayName: 'Search Anime', costCents: 1, description: 'Search anime by title', params: [{ name: 'query', type: 'string', required: true, description: 'Anime title' }] },
    { name: 'search_manga', displayName: 'Search Manga', costCents: 1, description: 'Search manga by title', params: [{ name: 'query', type: 'string', required: true, description: 'Manga title' }] },
    { name: 'get_top_anime', displayName: 'Top Anime', costCents: 1, description: 'Get top-rated anime', params: [{ name: 'type', type: 'string', required: false, description: '"tv", "movie", "ova", "special" (default: all)' }] },
  ],
  serverTs: `/**
 * settlegrid-anime — Anime & Manga (Jikan) MCP Server
 *
 * Methods:
 *   search_anime(query)   — Search anime      (1\u00A2)
 *   search_manga(query)   — Search manga      (1\u00A2)
 *   get_top_anime(type?)  — Top-rated anime   (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface TopInput { type?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.jikan.moe/v4'

async function jikanFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Jikan API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'anime',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_anime: { costCents: 1, displayName: 'Search Anime' },
      search_manga: { costCents: 1, displayName: 'Search Manga' },
      get_top_anime: { costCents: 1, displayName: 'Top Anime' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchAnime = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await jikanFetch<{ data: Array<{ mal_id: number; title: string; title_english: string; episodes: number; score: number; year: number; genres: Array<{ name: string }>; synopsis: string }> }>(\`/anime?q=\${q}&limit=10\`)
  return {
    query: args.query,
    count: data.data.length,
    anime: data.data.map((a) => ({
      malId: a.mal_id,
      title: a.title,
      titleEnglish: a.title_english,
      episodes: a.episodes,
      score: a.score,
      year: a.year,
      genres: a.genres?.map((g) => g.name),
      synopsis: a.synopsis?.slice(0, 300),
    })),
  }
}, { method: 'search_anime' })

const searchManga = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await jikanFetch<{ data: Array<{ mal_id: number; title: string; title_english: string; chapters: number; volumes: number; score: number; genres: Array<{ name: string }>; synopsis: string }> }>(\`/manga?q=\${q}&limit=10\`)
  return {
    query: args.query,
    count: data.data.length,
    manga: data.data.map((m) => ({
      malId: m.mal_id,
      title: m.title,
      titleEnglish: m.title_english,
      chapters: m.chapters,
      volumes: m.volumes,
      score: m.score,
      genres: m.genres?.map((g) => g.name),
      synopsis: m.synopsis?.slice(0, 300),
    })),
  }
}, { method: 'search_manga' })

const getTopAnime = sg.wrap(async (args: TopInput) => {
  const validTypes = ['tv', 'movie', 'ova', 'special']
  const typeParam = args.type && validTypes.includes(args.type) ? \`?type=\${args.type}\` : ''
  const data = await jikanFetch<{ data: Array<{ mal_id: number; title: string; score: number; episodes: number; year: number; rank: number }> }>(\`/top/anime\${typeParam}\`)
  return {
    type: args.type || 'all',
    anime: data.data.slice(0, 25).map((a) => ({
      rank: a.rank,
      malId: a.mal_id,
      title: a.title,
      score: a.score,
      episodes: a.episodes,
      year: a.year,
    })),
  }
}, { method: 'get_top_anime' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchAnime, searchManga, getTopAnime }

console.log('settlegrid-anime MCP server ready')
console.log('Methods: search_anime, search_manga, get_top_anime')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 170. CocktailDB — SKIP (already exists) ────────────────────────────────
console.log('  - settlegrid-cocktaildb (SKIP — already exists)')

console.log('\n=== Sports Servers (20) ===\n')

// ─── 171. Football-Data.org ─────────────────────────────────────────────────
generateServer({
  slug: 'football-data',
  name: 'Football-Data.org',
  description: 'Soccer/football competitions, standings, and match data from Football-Data.org.',
  keywords: ['sports', 'soccer', 'football', 'premier-league'],
  upstream: { provider: 'Football-Data.org', baseUrl: 'https://api.football-data.org/v4', auth: 'API key (header: X-Auth-Token)', rateLimit: '10 req/min (free)', docsUrl: 'https://www.football-data.org/documentation' },
  auth: { type: 'key', keyEnvVar: 'FOOTBALL_DATA_API_KEY', keyDesc: 'Football-Data.org API key (free tier)' },
  methods: [
    { name: 'get_standings', displayName: 'Get Standings', costCents: 2, description: 'Get league standings/table', params: [{ name: 'competition', type: 'string', required: true, description: 'Competition code (e.g. "PL", "BL1", "SA", "PD", "FL1")' }] },
    { name: 'get_matches', displayName: 'Get Matches', costCents: 2, description: 'Get recent/upcoming matches', params: [{ name: 'competition', type: 'string', required: true, description: 'Competition code' }, { name: 'matchday', type: 'number', required: false, description: 'Specific matchday number' }] },
    { name: 'get_team', displayName: 'Get Team', costCents: 2, description: 'Get team details and squad', params: [{ name: 'team_id', type: 'number', required: true, description: 'Team ID' }] },
  ],
  serverTs: `/**
 * settlegrid-football-data — Football-Data.org MCP Server
 *
 * Methods:
 *   get_standings(competition)             — League standings     (2\u00A2)
 *   get_matches(competition, matchday?)    — Matches              (2\u00A2)
 *   get_team(team_id)                      — Team details         (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { competition: string }
interface MatchesInput { competition: string; matchday?: number }
interface TeamInput { team_id: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || ''

async function fdFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('FOOTBALL_DATA_API_KEY environment variable is required')
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Football-Data API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const VALID_COMPETITIONS = new Set(['PL', 'BL1', 'SA', 'PD', 'FL1', 'ELC', 'DED', 'PPL', 'BSA', 'CL', 'EC', 'WC'])

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'football-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_standings: { costCents: 2, displayName: 'Get Standings' },
      get_matches: { costCents: 2, displayName: 'Get Matches' },
      get_team: { costCents: 2, displayName: 'Get Team' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStandings = sg.wrap(async (args: StandingsInput) => {
  if (!args.competition || typeof args.competition !== 'string') throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  if (!VALID_COMPETITIONS.has(code)) throw new Error(\`Invalid competition. Valid: \${[...VALID_COMPETITIONS].join(', ')}\`)
  const data = await fdFetch<{ competition: { name: string }; standings: Array<{ table: Array<{ position: number; team: { name: string; id: number }; playedGames: number; won: number; draw: number; lost: number; points: number; goalsFor: number; goalsAgainst: number; goalDifference: number }> }> }>(\`/competitions/\${code}/standings\`)
  const table = data.standings?.[0]?.table || []
  return {
    competition: data.competition?.name,
    standings: table.map((t) => ({
      position: t.position,
      team: t.team.name,
      teamId: t.team.id,
      played: t.playedGames,
      won: t.won,
      drawn: t.draw,
      lost: t.lost,
      points: t.points,
      gf: t.goalsFor,
      ga: t.goalsAgainst,
      gd: t.goalDifference,
    })),
  }
}, { method: 'get_standings' })

const getMatches = sg.wrap(async (args: MatchesInput) => {
  if (!args.competition || typeof args.competition !== 'string') throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  const mdParam = args.matchday ? \`?matchday=\${args.matchday}\` : ''
  const data = await fdFetch<{ matches: Array<{ id: number; utcDate: string; status: string; matchday: number; homeTeam: { name: string }; awayTeam: { name: string }; score: { fullTime: { home: number | null; away: number | null } } }> }>(\`/competitions/\${code}/matches\${mdParam}\`)
  return {
    competition: code,
    count: data.matches?.length || 0,
    matches: (data.matches || []).slice(0, 20).map((m) => ({
      id: m.id,
      date: m.utcDate,
      status: m.status,
      matchday: m.matchday,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.score?.fullTime?.home,
      awayScore: m.score?.fullTime?.away,
    })),
  }
}, { method: 'get_matches' })

const getTeam = sg.wrap(async (args: TeamInput) => {
  if (typeof args.team_id !== 'number' || args.team_id <= 0) throw new Error('team_id must be a positive number')
  const data = await fdFetch<{ id: number; name: string; shortName: string; crest: string; venue: string; founded: number; clubColors: string; squad: Array<{ id: number; name: string; position: string; nationality: string }> }>(\`/teams/\${args.team_id}\`)
  return {
    id: data.id,
    name: data.name,
    shortName: data.shortName,
    crest: data.crest,
    venue: data.venue,
    founded: data.founded,
    colors: data.clubColors,
    squad: data.squad?.slice(0, 30).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      nationality: p.nationality,
    })),
  }
}, { method: 'get_team' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStandings, getMatches, getTeam }

console.log('settlegrid-football-data MCP server ready')
console.log('Methods: get_standings, get_matches, get_team')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 172. API-Football ──────────────────────────────────────────────────────
generateServer({
  slug: 'api-football',
  name: 'API-Football',
  description: 'Football/soccer leagues, fixtures, and team data from API-Sports.',
  keywords: ['sports', 'soccer', 'football', 'fixtures'],
  upstream: { provider: 'API-Sports', baseUrl: 'https://v3.football.api-sports.io', auth: 'API key (header: x-apisports-key)', rateLimit: '100 req/day (free)', docsUrl: 'https://www.api-football.com/documentation-v3' },
  auth: { type: 'key', keyEnvVar: 'API_FOOTBALL_KEY', keyDesc: 'API-Football key from api-sports.io (free tier)' },
  methods: [
    { name: 'get_leagues', displayName: 'Get Leagues', costCents: 2, description: 'Get available football leagues', params: [{ name: 'country', type: 'string', required: false, description: 'Filter by country name' }] },
    { name: 'get_fixtures', displayName: 'Get Fixtures', costCents: 2, description: 'Get fixtures/matches for a league', params: [{ name: 'league', type: 'number', required: true, description: 'League ID' }, { name: 'season', type: 'number', required: true, description: 'Season year (e.g. 2024)' }] },
  ],
  serverTs: `/**
 * settlegrid-api-football — API-Football MCP Server
 *
 * Methods:
 *   get_leagues(country?)          — List leagues      (2\u00A2)
 *   get_fixtures(league, season)   — Get fixtures      (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LeaguesInput { country?: string }
interface FixturesInput { league: number; season: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://v3.football.api-sports.io'
const API_KEY = process.env.API_FOOTBALL_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY environment variable is required')
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API-Football \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'api-football',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_leagues: { costCents: 2, displayName: 'Get Leagues' },
      get_fixtures: { costCents: 2, displayName: 'Get Fixtures' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLeagues = sg.wrap(async (args: LeaguesInput) => {
  const countryParam = args.country ? \`?country=\${encodeURIComponent(args.country)}\` : ''
  const data = await apiFetch<{ response: Array<{ league: { id: number; name: string; type: string; logo: string }; country: { name: string; flag: string }; seasons: Array<{ year: number; current: boolean }> }> }>(\`/leagues\${countryParam}\`)
  return {
    count: data.response.length,
    leagues: data.response.slice(0, 20).map((l) => ({
      id: l.league.id,
      name: l.league.name,
      type: l.league.type,
      country: l.country.name,
      currentSeason: l.seasons?.find((s) => s.current)?.year,
    })),
  }
}, { method: 'get_leagues' })

const getFixtures = sg.wrap(async (args: FixturesInput) => {
  if (typeof args.league !== 'number' || args.league <= 0) throw new Error('league ID is required')
  if (typeof args.season !== 'number' || args.season < 2000) throw new Error('season year is required (e.g. 2024)')
  const data = await apiFetch<{ response: Array<{ fixture: { id: number; date: string; status: { short: string } }; teams: { home: { name: string }; away: { name: string } }; goals: { home: number | null; away: number | null } }> }>(\`/fixtures?league=\${args.league}&season=\${args.season}\`)
  return {
    league: args.league,
    season: args.season,
    count: data.response.length,
    fixtures: data.response.slice(0, 20).map((f) => ({
      id: f.fixture.id,
      date: f.fixture.date,
      status: f.fixture.status.short,
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeGoals: f.goals.home,
      awayGoals: f.goals.away,
    })),
  }
}, { method: 'get_fixtures' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLeagues, getFixtures }

console.log('settlegrid-api-football MCP server ready')
console.log('Methods: get_leagues, get_fixtures')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 173. NBA Stats ─────────────────────────────────────────────────────────
generateServer({
  slug: 'nba-stats',
  name: 'NBA Stats',
  description: 'NBA player stats, teams, and game data from BallDontLie.',
  keywords: ['sports', 'basketball', 'nba', 'stats'],
  upstream: { provider: 'BallDontLie', baseUrl: 'https://api.balldontlie.io/v1', auth: 'None required', rateLimit: '30 req/min', docsUrl: 'https://www.balldontlie.io/' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_players', displayName: 'Search Players', costCents: 1, description: 'Search NBA players by name', params: [{ name: 'query', type: 'string', required: true, description: 'Player name' }] },
    { name: 'get_teams', displayName: 'Get Teams', costCents: 1, description: 'List all NBA teams', params: [] },
    { name: 'get_games', displayName: 'Get Games', costCents: 1, description: 'Get NBA games by date', params: [{ name: 'date', type: 'string', required: true, description: 'Date in YYYY-MM-DD format' }] },
  ],
  serverTs: `/**
 * settlegrid-nba-stats — NBA Stats MCP Server
 *
 * Methods:
 *   search_players(query)  — Search NBA players   (1\u00A2)
 *   get_teams()            — List NBA teams       (1\u00A2)
 *   get_games(date)        — Games by date        (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GamesInput { date: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.balldontlie.io/v1'

async function nbaFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NBA API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nba-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_players: { costCents: 1, displayName: 'Search Players' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
      get_games: { costCents: 1, displayName: 'Get Games' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlayers = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await nbaFetch<{ data: Array<{ id: number; first_name: string; last_name: string; position: string; team: { full_name: string; abbreviation: string } }> }>(\`/players?search=\${q}\`)
  return {
    query: args.query,
    count: data.data.length,
    players: data.data.slice(0, 10).map((p) => ({
      id: p.id,
      name: \`\${p.first_name} \${p.last_name}\`,
      position: p.position,
      team: p.team?.full_name,
      teamAbbr: p.team?.abbreviation,
    })),
  }
}, { method: 'search_players' })

const getTeams = sg.wrap(async () => {
  const data = await nbaFetch<{ data: Array<{ id: number; abbreviation: string; city: string; conference: string; division: string; full_name: string; name: string }> }>('/teams')
  return {
    count: data.data.length,
    teams: data.data.map((t) => ({
      id: t.id,
      name: t.full_name,
      abbreviation: t.abbreviation,
      city: t.city,
      conference: t.conference,
      division: t.division,
    })),
  }
}, { method: 'get_teams' })

const getGames = sg.wrap(async (args: GamesInput) => {
  if (!args.date || typeof args.date !== 'string') throw new Error('date is required')
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) throw new Error('date must be YYYY-MM-DD')
  const data = await nbaFetch<{ data: Array<{ id: number; date: string; home_team: { full_name: string }; visitor_team: { full_name: string }; home_team_score: number; visitor_team_score: number; status: string }> }>(\`/games?dates[]=\${args.date}\`)
  return {
    date: args.date,
    count: data.data.length,
    games: data.data.map((g) => ({
      id: g.id,
      homeTeam: g.home_team.full_name,
      awayTeam: g.visitor_team.full_name,
      homeScore: g.home_team_score,
      awayScore: g.visitor_team_score,
      status: g.status,
    })),
  }
}, { method: 'get_games' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlayers, getTeams, getGames }

console.log('settlegrid-nba-stats MCP server ready')
console.log('Methods: search_players, get_teams, get_games')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 174. MLB Stats ─────────────────────────────────────────────────────────
generateServer({
  slug: 'mlb-stats',
  name: 'MLB Stats',
  description: 'MLB baseball teams, players, schedules, and standings from the official MLB Stats API.',
  keywords: ['sports', 'baseball', 'mlb', 'stats'],
  upstream: { provider: 'MLB', baseUrl: 'https://statsapi.mlb.com/api/v1', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://statsapi.mlb.com/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_standings', displayName: 'Get Standings', costCents: 1, description: 'Get MLB standings by league', params: [{ name: 'league_id', type: 'number', required: false, description: 'League ID: 103 (AL) or 104 (NL). Default: both.' }] },
    { name: 'get_schedule', displayName: 'Get Schedule', costCents: 1, description: 'Get games for a date', params: [{ name: 'date', type: 'string', required: true, description: 'Date in YYYY-MM-DD format' }] },
    { name: 'get_teams', displayName: 'Get Teams', costCents: 1, description: 'List all MLB teams', params: [] },
  ],
  serverTs: `/**
 * settlegrid-mlb-stats — MLB Stats MCP Server
 *
 * Methods:
 *   get_standings(league_id?)  — MLB standings    (1\u00A2)
 *   get_schedule(date)         — Games by date    (1\u00A2)
 *   get_teams()                — List teams       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { league_id?: number }
interface ScheduleInput { date: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://statsapi.mlb.com/api/v1'

async function mlbFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`MLB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mlb-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_standings: { costCents: 1, displayName: 'Get Standings' },
      get_schedule: { costCents: 1, displayName: 'Get Schedule' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStandings = sg.wrap(async (args: StandingsInput) => {
  const leagueParam = args.league_id ? \`&leagueId=\${args.league_id}\` : ''
  const data = await mlbFetch<{ records: Array<{ division: { name: string }; teamRecords: Array<{ team: { name: string; id: number }; wins: number; losses: number; winningPercentage: string; gamesBack: string }> }> }>(\`/standings?sportId=1\${leagueParam}\`)
  return {
    divisions: (data.records || []).map((d) => ({
      division: d.division?.name,
      teams: d.teamRecords?.map((t) => ({
        team: t.team.name,
        teamId: t.team.id,
        wins: t.wins,
        losses: t.losses,
        pct: t.winningPercentage,
        gb: t.gamesBack,
      })),
    })),
  }
}, { method: 'get_standings' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  if (!args.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) throw new Error('date is required (YYYY-MM-DD)')
  const data = await mlbFetch<{ dates: Array<{ date: string; games: Array<{ gamePk: number; gameDate: string; status: { detailedState: string }; teams: { home: { team: { name: string }; score: number }; away: { team: { name: string }; score: number } } }> }> }>(\`/schedule?sportId=1&date=\${args.date}\`)
  const dateData = data.dates?.[0]
  return {
    date: args.date,
    games: (dateData?.games || []).map((g) => ({
      id: g.gamePk,
      status: g.status?.detailedState,
      homeTeam: g.teams.home.team.name,
      awayTeam: g.teams.away.team.name,
      homeScore: g.teams.home.score,
      awayScore: g.teams.away.score,
    })),
  }
}, { method: 'get_schedule' })

const getTeams = sg.wrap(async () => {
  const data = await mlbFetch<{ teams: Array<{ id: number; name: string; abbreviation: string; league: { name: string }; division: { name: string }; venue: { name: string } }> }>('/teams?sportId=1')
  return {
    count: data.teams?.length || 0,
    teams: (data.teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      abbreviation: t.abbreviation,
      league: t.league?.name,
      division: t.division?.name,
      venue: t.venue?.name,
    })),
  }
}, { method: 'get_teams' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStandings, getSchedule, getTeams }

console.log('settlegrid-mlb-stats MCP server ready')
console.log('Methods: get_standings, get_schedule, get_teams')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 175. NHL Stats ─────────────────────────────────────────────────────────
generateServer({
  slug: 'nhl-stats',
  name: 'NHL Stats',
  description: 'NHL hockey teams, standings, and schedule from the NHL Web API.',
  keywords: ['sports', 'hockey', 'nhl', 'stats'],
  upstream: { provider: 'NHL', baseUrl: 'https://api-web.nhle.com/v1', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://api-web.nhle.com/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_standings', displayName: 'Get Standings', costCents: 1, description: 'Get current NHL standings', params: [{ name: 'date', type: 'string', required: false, description: 'Date for standings (YYYY-MM-DD)' }] },
    { name: 'get_schedule', displayName: 'Get Schedule', costCents: 1, description: 'Get games for a date', params: [{ name: 'date', type: 'string', required: true, description: 'Date in YYYY-MM-DD format' }] },
    { name: 'get_roster', displayName: 'Get Roster', costCents: 1, description: 'Get team roster', params: [{ name: 'team', type: 'string', required: true, description: 'Team abbreviation (e.g. "TOR", "BOS")' }] },
  ],
  serverTs: `/**
 * settlegrid-nhl-stats — NHL Stats MCP Server
 *
 * Methods:
 *   get_standings(date?)    — NHL standings      (1\u00A2)
 *   get_schedule(date)      — Games by date      (1\u00A2)
 *   get_roster(team)        — Team roster        (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { date?: string }
interface ScheduleInput { date: string }
interface RosterInput { team: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api-web.nhle.com/v1'

async function nhlFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NHL API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nhl-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_standings: { costCents: 1, displayName: 'Get Standings' },
      get_schedule: { costCents: 1, displayName: 'Get Schedule' },
      get_roster: { costCents: 1, displayName: 'Get Roster' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStandings = sg.wrap(async (args: StandingsInput) => {
  const dateParam = args.date ? \`/\${args.date}\` : '/now'
  const data = await nhlFetch<{ standings: Array<{ teamAbbrev: { default: string }; teamName: { default: string }; conferenceName: string; divisionName: string; gamesPlayed: number; wins: number; losses: number; otLosses: number; points: number; goalFor: number; goalAgainst: number }> }>(\`/standings\${dateParam}\`)
  return {
    count: data.standings?.length || 0,
    standings: (data.standings || []).map((t) => ({
      team: t.teamName?.default,
      abbrev: t.teamAbbrev?.default,
      conference: t.conferenceName,
      division: t.divisionName,
      gp: t.gamesPlayed,
      wins: t.wins,
      losses: t.losses,
      otl: t.otLosses,
      points: t.points,
      gf: t.goalFor,
      ga: t.goalAgainst,
    })),
  }
}, { method: 'get_standings' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  if (!args.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) throw new Error('date is required (YYYY-MM-DD)')
  const data = await nhlFetch<{ gameWeek: Array<{ date: string; games: Array<{ id: number; startTimeUTC: string; gameState: string; homeTeam: { abbrev: string; score: number }; awayTeam: { abbrev: string; score: number } }> }> }>(\`/schedule/\${args.date}\`)
  const dayGames = data.gameWeek?.find((d) => d.date === args.date)
  return {
    date: args.date,
    games: (dayGames?.games || []).map((g) => ({
      id: g.id,
      startTime: g.startTimeUTC,
      state: g.gameState,
      home: g.homeTeam?.abbrev,
      away: g.awayTeam?.abbrev,
      homeScore: g.homeTeam?.score,
      awayScore: g.awayTeam?.score,
    })),
  }
}, { method: 'get_schedule' })

const getRoster = sg.wrap(async (args: RosterInput) => {
  if (!args.team || typeof args.team !== 'string') throw new Error('team abbreviation is required')
  const team = args.team.toUpperCase().trim()
  if (!/^[A-Z]{3}$/.test(team)) throw new Error('team must be a 3-letter abbreviation (e.g. "TOR")')
  const data = await nhlFetch<{ forwards: Array<{ id: number; firstName: { default: string }; lastName: { default: string }; sweaterNumber: number; positionCode: string }>; defensemen: Array<{ id: number; firstName: { default: string }; lastName: { default: string }; sweaterNumber: number; positionCode: string }>; goalies: Array<{ id: number; firstName: { default: string }; lastName: { default: string }; sweaterNumber: number; positionCode: string }> }>(\`/roster/\${team}/current\`)
  const allPlayers = [...(data.forwards || []), ...(data.defensemen || []), ...(data.goalies || [])]
  return {
    team,
    count: allPlayers.length,
    players: allPlayers.map((p) => ({
      id: p.id,
      name: \`\${p.firstName?.default} \${p.lastName?.default}\`,
      number: p.sweaterNumber,
      position: p.positionCode,
    })),
  }
}, { method: 'get_roster' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStandings, getSchedule, getRoster }

console.log('settlegrid-nhl-stats MCP server ready')
console.log('Methods: get_standings, get_schedule, get_roster')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 176. F1 Data ───────────────────────────────────────────────────────────
generateServer({
  slug: 'f1-data',
  name: 'Formula 1 Data',
  description: 'Formula 1 race results, driver standings, and constructor data from the Ergast API.',
  keywords: ['sports', 'f1', 'formula-1', 'racing', 'motorsport'],
  upstream: { provider: 'Ergast', baseUrl: 'https://ergast.com/api/f1', auth: 'None required', rateLimit: '4 req/sec', docsUrl: 'https://ergast.com/mrd/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_driver_standings', displayName: 'Driver Standings', costCents: 1, description: 'Get current F1 driver standings', params: [{ name: 'season', type: 'string', required: false, description: 'Season year (default: current)' }] },
    { name: 'get_race_results', displayName: 'Race Results', costCents: 1, description: 'Get results for a specific race', params: [{ name: 'season', type: 'string', required: true, description: 'Season year' }, { name: 'round', type: 'number', required: true, description: 'Race round number' }] },
    { name: 'get_schedule', displayName: 'Race Schedule', costCents: 1, description: 'Get the race schedule', params: [{ name: 'season', type: 'string', required: false, description: 'Season year (default: current)' }] },
  ],
  serverTs: `/**
 * settlegrid-f1-data — Formula 1 MCP Server
 *
 * Methods:
 *   get_driver_standings(season?)      — Driver standings    (1\u00A2)
 *   get_race_results(season, round)    — Race results        (1\u00A2)
 *   get_schedule(season?)              — Race schedule       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { season?: string }
interface RaceResultsInput { season: string; round: number }
interface ScheduleInput { season?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://ergast.com/api/f1'

async function f1Fetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}.json\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Ergast API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'f1-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_driver_standings: { costCents: 1, displayName: 'Driver Standings' },
      get_race_results: { costCents: 1, displayName: 'Race Results' },
      get_schedule: { costCents: 1, displayName: 'Race Schedule' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDriverStandings = sg.wrap(async (args: StandingsInput) => {
  const season = args.season || 'current'
  const data = await f1Fetch<{ MRData: { StandingsTable: { StandingsLists: Array<{ DriverStandings: Array<{ position: string; points: string; wins: string; Driver: { givenName: string; familyName: string; nationality: string }; Constructors: Array<{ name: string }> }> }> } } }>(\`/\${season}/driverStandings\`)
  const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []
  return {
    season,
    drivers: standings.map((d) => ({
      position: parseInt(d.position, 10),
      name: \`\${d.Driver.givenName} \${d.Driver.familyName}\`,
      nationality: d.Driver.nationality,
      team: d.Constructors?.[0]?.name,
      points: parseFloat(d.points),
      wins: parseInt(d.wins, 10),
    })),
  }
}, { method: 'get_driver_standings' })

const getRaceResults = sg.wrap(async (args: RaceResultsInput) => {
  if (!args.season) throw new Error('season is required')
  if (typeof args.round !== 'number' || args.round < 1) throw new Error('round must be a positive number')
  const data = await f1Fetch<{ MRData: { RaceTable: { Races: Array<{ raceName: string; date: string; Circuit: { circuitName: string; Location: { country: string } }; Results: Array<{ position: string; Driver: { givenName: string; familyName: string }; Constructor: { name: string }; status: string; Time?: { time: string } }> }> } } }>(\`/\${args.season}/\${args.round}/results\`)
  const race = data.MRData?.RaceTable?.Races?.[0]
  if (!race) throw new Error(\`No results for \${args.season} round \${args.round}\`)
  return {
    raceName: race.raceName,
    date: race.date,
    circuit: race.Circuit?.circuitName,
    country: race.Circuit?.Location?.country,
    results: (race.Results || []).map((r) => ({
      position: parseInt(r.position, 10),
      driver: \`\${r.Driver.givenName} \${r.Driver.familyName}\`,
      team: r.Constructor?.name,
      status: r.status,
      time: r.Time?.time,
    })),
  }
}, { method: 'get_race_results' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  const season = args.season || 'current'
  const data = await f1Fetch<{ MRData: { RaceTable: { Races: Array<{ round: string; raceName: string; date: string; time: string; Circuit: { circuitName: string; Location: { country: string; locality: string } } }> } } }>(\`/\${season}\`)
  return {
    season,
    races: (data.MRData?.RaceTable?.Races || []).map((r) => ({
      round: parseInt(r.round, 10),
      name: r.raceName,
      date: r.date,
      time: r.time,
      circuit: r.Circuit?.circuitName,
      location: \`\${r.Circuit?.Location?.locality}, \${r.Circuit?.Location?.country}\`,
    })),
  }
}, { method: 'get_schedule' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDriverStandings, getRaceResults, getSchedule }

console.log('settlegrid-f1-data MCP server ready')
console.log('Methods: get_driver_standings, get_race_results, get_schedule')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 177. Cricket ───────────────────────────────────────────────────────────
generateServer({
  slug: 'cricket',
  name: 'Cricket Data',
  description: 'Cricket match data, scores, and series information from CricAPI.',
  keywords: ['sports', 'cricket', 'scores', 'ipl'],
  upstream: { provider: 'CricAPI', baseUrl: 'https://api.cricapi.com/v1', auth: 'API key (query param)', rateLimit: '100 req/day (free)', docsUrl: 'https://cricapi.com/' },
  auth: { type: 'key', keyEnvVar: 'CRICAPI_KEY', keyDesc: 'CricAPI key (free at cricapi.com)' },
  methods: [
    { name: 'get_matches', displayName: 'Current Matches', costCents: 2, description: 'Get current/recent cricket matches', params: [] },
    { name: 'get_series', displayName: 'Get Series', costCents: 2, description: 'Get cricket series list', params: [] },
  ],
  serverTs: `/**
 * settlegrid-cricket — Cricket Data MCP Server
 *
 * Methods:
 *   get_matches()   — Current matches    (2\u00A2)
 *   get_series()    — Series list        (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.cricapi.com/v1'
const API_KEY = process.env.CRICAPI_KEY || ''

async function cricFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('CRICAPI_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${BASE}\${path}\${sep}apikey=\${API_KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`CricAPI \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cricket',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_matches: { costCents: 2, displayName: 'Current Matches' },
      get_series: { costCents: 2, displayName: 'Get Series' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMatches = sg.wrap(async () => {
  const data = await cricFetch<{ data: Array<{ id: string; name: string; status: string; venue: string; date: string; teams: string[]; score: Array<{ r: number; w: number; o: number; inning: string }> }> }>('/currentMatches')
  return {
    count: data.data?.length || 0,
    matches: (data.data || []).slice(0, 15).map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      venue: m.venue,
      date: m.date,
      teams: m.teams,
      score: m.score,
    })),
  }
}, { method: 'get_matches' })

const getSeries = sg.wrap(async () => {
  const data = await cricFetch<{ data: Array<{ id: string; name: string; startDate: string; endDate: string; odi: number; t20: number; test: number }> }>('/series')
  return {
    count: data.data?.length || 0,
    series: (data.data || []).slice(0, 20).map((s) => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      odi: s.odi,
      t20: s.t20,
      test: s.test,
    })),
  }
}, { method: 'get_series' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMatches, getSeries }

console.log('settlegrid-cricket MCP server ready')
console.log('Methods: get_matches, get_series')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 178. TheSportsDB ───────────────────────────────────────────────────────
generateServer({
  slug: 'thesportsdb',
  name: 'TheSportsDB',
  description: 'Multi-sport data: teams, players, events, and leagues from TheSportsDB.',
  keywords: ['sports', 'multi-sport', 'teams', 'events'],
  upstream: { provider: 'TheSportsDB', baseUrl: 'https://www.thesportsdb.com/api/v1/json/3', auth: 'Free key included', rateLimit: 'Reasonable use', docsUrl: 'https://www.thesportsdb.com/api.php' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_teams', displayName: 'Search Teams', costCents: 1, description: 'Search teams by name', params: [{ name: 'query', type: 'string', required: true, description: 'Team name' }] },
    { name: 'search_players', displayName: 'Search Players', costCents: 1, description: 'Search players by name', params: [{ name: 'query', type: 'string', required: true, description: 'Player name' }] },
    { name: 'get_events', displayName: 'Get Events', costCents: 1, description: 'Get last/next events for a team', params: [{ name: 'team_id', type: 'string', required: true, description: 'Team ID' }, { name: 'type', type: 'string', required: false, description: '"last" or "next" (default: "next")' }] },
  ],
  serverTs: `/**
 * settlegrid-thesportsdb — TheSportsDB MCP Server
 *
 * Methods:
 *   search_teams(query)             — Search teams       (1\u00A2)
 *   search_players(query)           — Search players     (1\u00A2)
 *   get_events(team_id, type?)      — Team events        (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface EventsInput { team_id: string; type?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function sdbFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`TheSportsDB \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'thesportsdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_teams: { costCents: 1, displayName: 'Search Teams' },
      search_players: { costCents: 1, displayName: 'Search Players' },
      get_events: { costCents: 1, displayName: 'Get Events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTeams = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await sdbFetch<{ teams: Array<{ idTeam: string; strTeam: string; strSport: string; strLeague: string; strCountry: string; strStadium: string; strDescriptionEN: string }> | null }>(\`/searchteams.php?t=\${q}\`)
  return {
    query: args.query,
    teams: (data.teams || []).map((t) => ({
      id: t.idTeam,
      name: t.strTeam,
      sport: t.strSport,
      league: t.strLeague,
      country: t.strCountry,
      stadium: t.strStadium,
      description: t.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_teams' })

const searchPlayers = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await sdbFetch<{ player: Array<{ idPlayer: string; strPlayer: string; strSport: string; strTeam: string; strNationality: string; strPosition: string; dateBorn: string }> | null }>(\`/searchplayers.php?p=\${q}\`)
  return {
    query: args.query,
    players: (data.player || []).map((p) => ({
      id: p.idPlayer,
      name: p.strPlayer,
      sport: p.strSport,
      team: p.strTeam,
      nationality: p.strNationality,
      position: p.strPosition,
      born: p.dateBorn,
    })),
  }
}, { method: 'search_players' })

const getEvents = sg.wrap(async (args: EventsInput) => {
  if (!args.team_id || typeof args.team_id !== 'string') throw new Error('team_id is required')
  const endpoint = args.type === 'last' ? 'eventslast' : 'eventsnext'
  const data = await sdbFetch<{ results: Array<{ idEvent: string; strEvent: string; strLeague: string; dateEvent: string; strTime: string; strHomeTeam: string; strAwayTeam: string; intHomeScore: string; intAwayScore: string }> | null }>(\`/\${endpoint}.php?id=\${args.team_id}\`)
  return {
    teamId: args.team_id,
    type: args.type || 'next',
    events: (data.results || []).map((e) => ({
      id: e.idEvent,
      name: e.strEvent,
      league: e.strLeague,
      date: e.dateEvent,
      time: e.strTime,
      homeTeam: e.strHomeTeam,
      awayTeam: e.strAwayTeam,
      homeScore: e.intHomeScore,
      awayScore: e.intAwayScore,
    })),
  }
}, { method: 'get_events' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTeams, searchPlayers, getEvents }

console.log('settlegrid-thesportsdb MCP server ready')
console.log('Methods: search_teams, search_players, get_events')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 179. BallDontLie ───────────────────────────────────────────────────────
generateServer({
  slug: 'balldontlie',
  name: 'BallDontLie NBA',
  description: 'NBA player season averages and detailed game stats from BallDontLie.',
  keywords: ['sports', 'basketball', 'nba', 'player-stats'],
  upstream: { provider: 'BallDontLie', baseUrl: 'https://api.balldontlie.io/v1', auth: 'None required', rateLimit: '30 req/min', docsUrl: 'https://www.balldontlie.io/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_season_averages', displayName: 'Season Averages', costCents: 1, description: 'Get player season averages', params: [{ name: 'player_id', type: 'number', required: true, description: 'Player ID' }, { name: 'season', type: 'number', required: false, description: 'Season year (default: current)' }] },
    { name: 'get_player_stats', displayName: 'Player Game Stats', costCents: 1, description: 'Get detailed game stats for a player', params: [{ name: 'player_id', type: 'number', required: true, description: 'Player ID' }, { name: 'season', type: 'number', required: false, description: 'Season year' }] },
  ],
  serverTs: `/**
 * settlegrid-balldontlie — BallDontLie NBA MCP Server
 *
 * Methods:
 *   get_season_averages(player_id, season?)  — Season averages      (1\u00A2)
 *   get_player_stats(player_id, season?)     — Player game stats    (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeasonAvgInput { player_id: number; season?: number }
interface PlayerStatsInput { player_id: number; season?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.balldontlie.io/v1'

async function bdlFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`BallDontLie API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'balldontlie',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_season_averages: { costCents: 1, displayName: 'Season Averages' },
      get_player_stats: { costCents: 1, displayName: 'Player Game Stats' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeasonAverages = sg.wrap(async (args: SeasonAvgInput) => {
  if (typeof args.player_id !== 'number' || args.player_id <= 0) throw new Error('player_id must be a positive number')
  const seasonParam = args.season ? \`&season=\${args.season}\` : ''
  const data = await bdlFetch<{ data: Array<{ games_played: number; pts: number; reb: number; ast: number; stl: number; blk: number; fg_pct: number; fg3_pct: number; ft_pct: number; min: string }> }>(\`/season_averages?player_ids[]=\${args.player_id}\${seasonParam}\`)
  const avg = data.data?.[0]
  if (!avg) return { playerId: args.player_id, message: 'No season averages found' }
  return {
    playerId: args.player_id,
    gamesPlayed: avg.games_played,
    ppg: avg.pts,
    rpg: avg.reb,
    apg: avg.ast,
    spg: avg.stl,
    bpg: avg.blk,
    fgPct: avg.fg_pct,
    fg3Pct: avg.fg3_pct,
    ftPct: avg.ft_pct,
    mpg: avg.min,
  }
}, { method: 'get_season_averages' })

const getPlayerStats = sg.wrap(async (args: PlayerStatsInput) => {
  if (typeof args.player_id !== 'number' || args.player_id <= 0) throw new Error('player_id must be a positive number')
  const seasonParam = args.season ? \`&seasons[]=\${args.season}\` : ''
  const data = await bdlFetch<{ data: Array<{ game: { date: string; home_team_score: number; visitor_team_score: number }; pts: number; reb: number; ast: number; stl: number; blk: number; min: string }> }>(\`/stats?player_ids[]=\${args.player_id}\${seasonParam}&per_page=10\`)
  return {
    playerId: args.player_id,
    games: (data.data || []).map((s) => ({
      date: s.game?.date,
      points: s.pts,
      rebounds: s.reb,
      assists: s.ast,
      steals: s.stl,
      blocks: s.blk,
      minutes: s.min,
    })),
  }
}, { method: 'get_player_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeasonAverages, getPlayerStats }

console.log('settlegrid-balldontlie MCP server ready')
console.log('Methods: get_season_averages, get_player_stats')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 180. NFL Data ──────────────────────────────────────────────────────────
generateServer({
  slug: 'nfl-data',
  name: 'NFL Data',
  description: 'NFL teams, scores, and standings from the ESPN public API.',
  keywords: ['sports', 'football', 'nfl', 'american-football'],
  upstream: { provider: 'ESPN', baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_scoreboard', displayName: 'Scoreboard', costCents: 1, description: 'Get current/recent NFL scores', params: [{ name: 'week', type: 'number', required: false, description: 'NFL week number' }] },
    { name: 'get_standings', displayName: 'Standings', costCents: 1, description: 'Get NFL standings', params: [] },
    { name: 'get_teams', displayName: 'Get Teams', costCents: 1, description: 'List all NFL teams', params: [] },
  ],
  serverTs: `/**
 * settlegrid-nfl-data — NFL Data MCP Server
 *
 * Methods:
 *   get_scoreboard(week?)   — NFL scores        (1\u00A2)
 *   get_standings()         — NFL standings     (1\u00A2)
 *   get_teams()             — List teams        (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreboardInput { week?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

async function espnFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ESPN API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nfl-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Scoreboard' },
      get_standings: { costCents: 1, displayName: 'Standings' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: ScoreboardInput) => {
  const weekParam = args.week ? \`?week=\${args.week}\` : ''
  const data = await espnFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ team: { displayName: string; abbreviation: string }; score: string; winner: boolean }> }> }> }>(\`/scoreboard\${weekParam}\`)
  return {
    count: data.events?.length || 0,
    games: (data.events || []).map((e) => {
      const comp = e.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => (c as any).homeAway === 'home') || comp?.competitors?.[0]
      const away = comp?.competitors?.find((c: any) => (c as any).homeAway === 'away') || comp?.competitors?.[1]
      return {
        id: e.id,
        name: e.name,
        date: e.date,
        status: e.status?.type?.description,
        homeTeam: home?.team?.displayName,
        awayTeam: away?.team?.displayName,
        homeScore: home?.score,
        awayScore: away?.score,
      }
    }),
  }
}, { method: 'get_scoreboard' })

const getStandings = sg.wrap(async () => {
  const data = await espnFetch<{ children: Array<{ name: string; standings: { entries: Array<{ team: { displayName: string; abbreviation: string }; stats: Array<{ name: string; displayValue: string }> }> } }> }>('/standings')
  return {
    groups: (data.children || []).map((g) => ({
      name: g.name,
      teams: (g.standings?.entries || []).map((e) => {
        const getStat = (name: string) => e.stats?.find((s) => s.name === name)?.displayValue
        return {
          team: e.team?.displayName,
          abbr: e.team?.abbreviation,
          wins: getStat('wins'),
          losses: getStat('losses'),
          ties: getStat('ties'),
          pct: getStat('winPercent'),
        }
      }),
    })),
  }
}, { method: 'get_standings' })

const getTeams = sg.wrap(async () => {
  const data = await espnFetch<{ sports: Array<{ leagues: Array<{ teams: Array<{ team: { id: string; displayName: string; abbreviation: string; location: string; color: string } }> }> }> }>('/teams')
  const teams = data.sports?.[0]?.leagues?.[0]?.teams || []
  return {
    count: teams.length,
    teams: teams.map((t) => ({
      id: t.team.id,
      name: t.team.displayName,
      abbreviation: t.team.abbreviation,
      location: t.team.location,
    })),
  }
}, { method: 'get_teams' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getStandings, getTeams }

console.log('settlegrid-nfl-data MCP server ready')
console.log('Methods: get_scoreboard, get_standings, get_teams')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 181. Olympics ──────────────────────────────────────────────────────────
generateServer({
  slug: 'olympics',
  name: 'Olympic Games Data',
  description: 'Olympic Games events, athletes, and medal data.',
  keywords: ['sports', 'olympics', 'medals', 'athletes'],
  upstream: { provider: 'Codante Olympic API', baseUrl: 'https://apis.codante.io/olympic-games', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://apis.codante.io/olympic-games' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_events', displayName: 'Get Events', costCents: 1, description: 'Get Olympic events/disciplines', params: [] },
    { name: 'get_countries', displayName: 'Get Countries', costCents: 1, description: 'Get participating countries and medals', params: [] },
  ],
  serverTs: `/**
 * settlegrid-olympics — Olympic Games MCP Server
 *
 * Methods:
 *   get_events()       — Olympic events       (1\u00A2)
 *   get_countries()    — Countries & medals   (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://apis.codante.io/olympic-games'

async function olympicFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Olympic API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'olympics',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_events: { costCents: 1, displayName: 'Get Events' },
      get_countries: { costCents: 1, displayName: 'Get Countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEvents = sg.wrap(async () => {
  const data = await olympicFetch<{ data: Array<{ id: number; discipline: string; event: string; venue: string; date: string; status: string }> }>('/events')
  return {
    count: data.data?.length || 0,
    events: (data.data || []).slice(0, 25).map((e) => ({
      id: e.id,
      discipline: e.discipline,
      event: e.event,
      venue: e.venue,
      date: e.date,
      status: e.status,
    })),
  }
}, { method: 'get_events' })

const getCountries = sg.wrap(async () => {
  const data = await olympicFetch<{ data: Array<{ id: string; name: string; gold: number; silver: number; bronze: number; total: number }> }>('/countries')
  return {
    count: data.data?.length || 0,
    countries: (data.data || []).slice(0, 30).map((c) => ({
      code: c.id,
      name: c.name,
      gold: c.gold,
      silver: c.silver,
      bronze: c.bronze,
      total: c.total,
    })),
  }
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEvents, getCountries }

console.log('settlegrid-olympics MCP server ready')
console.log('Methods: get_events, get_countries')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 182. UFC Data ──────────────────────────────────────────────────────────
generateServer({
  slug: 'ufc-data',
  name: 'UFC / MMA Data',
  description: 'UFC fight data, events, and fighter info from ESPN.',
  keywords: ['sports', 'ufc', 'mma', 'fighting'],
  upstream: { provider: 'ESPN', baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_scoreboard', displayName: 'UFC Scoreboard', costCents: 1, description: 'Get recent/upcoming UFC events and results', params: [] },
    { name: 'get_rankings', displayName: 'UFC Rankings', costCents: 1, description: 'Get UFC fighter rankings by division', params: [] },
  ],
  serverTs: `/**
 * settlegrid-ufc-data — UFC / MMA Data MCP Server
 *
 * Methods:
 *   get_scoreboard()   — UFC events/results    (1\u00A2)
 *   get_rankings()     — Fighter rankings      (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc'

async function ufcFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ESPN UFC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ufc-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'UFC Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'UFC Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await ufcFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; score: string; winner: boolean }> }> }> }>('/scoreboard')
  return {
    count: data.events?.length || 0,
    events: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      fights: (e.competitions || []).slice(0, 5).map((c) => ({
        fighter1: c.competitors?.[0]?.athlete?.displayName,
        fighter2: c.competitors?.[1]?.athlete?.displayName,
        score1: c.competitors?.[0]?.score,
        score2: c.competitors?.[1]?.score,
        winner: c.competitors?.find((f) => f.winner)?.athlete?.displayName,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async () => {
  const data = await ufcFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string }; record: { displayValue: string } }> }> | null }>('/rankings')
  return {
    divisions: (data.rankings || []).map((d) => ({
      division: d.name,
      fighters: (d.ranks || []).slice(0, 15).map((r) => ({
        rank: r.current,
        name: r.athlete?.displayName,
        record: r.record?.displayValue,
      })),
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-ufc-data MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 183. Tennis ────────────────────────────────────────────────────────────
generateServer({
  slug: 'tennis',
  name: 'Tennis Data',
  description: 'Tennis scores, rankings, and tournament data from ESPN.',
  keywords: ['sports', 'tennis', 'atp', 'wta'],
  upstream: { provider: 'ESPN', baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/tennis', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_scoreboard', displayName: 'Tennis Scoreboard', costCents: 1, description: 'Get current tennis scores and results', params: [{ name: 'tour', type: 'string', required: false, description: '"atp" or "wta" (default: "atp")' }] },
    { name: 'get_rankings', displayName: 'Tennis Rankings', costCents: 1, description: 'Get tennis rankings', params: [{ name: 'tour', type: 'string', required: false, description: '"atp" or "wta" (default: "atp")' }] },
  ],
  serverTs: `/**
 * settlegrid-tennis — Tennis Data MCP Server
 *
 * Methods:
 *   get_scoreboard(tour?)   — Tennis scores      (1\u00A2)
 *   get_rankings(tour?)     — Tennis rankings    (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TourInput { tour?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/tennis'

function getTour(tour?: string): string {
  return tour === 'wta' ? 'wta' : 'atp'
}

async function tennisFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ESPN Tennis API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tennis',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Tennis Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'Tennis Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: TourInput) => {
  const tour = getTour(args.tour)
  const data = await tennisFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; score: string; winner: boolean }> }> }> }>(\`/\${tour}/scoreboard\`)
  return {
    tour: tour.toUpperCase(),
    count: data.events?.length || 0,
    matches: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      player1: e.competitions?.[0]?.competitors?.[0]?.athlete?.displayName,
      player2: e.competitions?.[0]?.competitors?.[1]?.athlete?.displayName,
      score1: e.competitions?.[0]?.competitors?.[0]?.score,
      score2: e.competitions?.[0]?.competitors?.[1]?.score,
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async (args: TourInput) => {
  const tour = getTour(args.tour)
  const data = await tennisFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string; flag: { alt: string } }; record: { displayValue: string }; stats: Array<{ displayValue: string }> }> }> | null }>(\`/\${tour}/rankings\`)
  const ranking = data.rankings?.[0]
  return {
    tour: tour.toUpperCase(),
    name: ranking?.name,
    players: (ranking?.ranks || []).slice(0, 25).map((r) => ({
      rank: r.current,
      name: r.athlete?.displayName,
      country: r.athlete?.flag?.alt,
      record: r.record?.displayValue,
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-tennis MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 184. Rugby ─────────────────────────────────────────────────────────────
generateServer({
  slug: 'rugby',
  name: 'Rugby Data',
  description: 'Rugby scores, standings, and team data from ESPN.',
  keywords: ['sports', 'rugby', 'six-nations', 'world-cup'],
  upstream: { provider: 'ESPN', baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/rugby', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_scoreboard', displayName: 'Rugby Scoreboard', costCents: 1, description: 'Get current rugby scores', params: [{ name: 'league', type: 'string', required: false, description: 'League slug (default: "world-rugby")' }] },
    { name: 'get_teams', displayName: 'Get Teams', costCents: 1, description: 'List rugby teams', params: [{ name: 'league', type: 'string', required: false, description: 'League slug' }] },
  ],
  serverTs: `/**
 * settlegrid-rugby — Rugby Data MCP Server
 *
 * Methods:
 *   get_scoreboard(league?)   — Rugby scores     (1\u00A2)
 *   get_teams(league?)        — List teams       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LeagueInput { league?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/rugby'

async function rugbyFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ESPN Rugby API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rugby',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Rugby Scoreboard' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: LeagueInput) => {
  const league = args.league || 'world-rugby'
  const data = await rugbyFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ team: { displayName: string }; score: string }> }> }> }>(\`/\${league}/scoreboard\`)
  return {
    league,
    count: data.events?.length || 0,
    matches: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      team1: e.competitions?.[0]?.competitors?.[0]?.team?.displayName,
      team2: e.competitions?.[0]?.competitors?.[1]?.team?.displayName,
      score1: e.competitions?.[0]?.competitors?.[0]?.score,
      score2: e.competitions?.[0]?.competitors?.[1]?.score,
    })),
  }
}, { method: 'get_scoreboard' })

const getTeams = sg.wrap(async (args: LeagueInput) => {
  const league = args.league || 'world-rugby'
  const data = await rugbyFetch<{ sports: Array<{ leagues: Array<{ teams: Array<{ team: { id: string; displayName: string; abbreviation: string; location: string } }> }> }> }>(\`/\${league}/teams\`)
  const teams = data.sports?.[0]?.leagues?.[0]?.teams || []
  return {
    league,
    count: teams.length,
    teams: teams.map((t) => ({
      id: t.team.id,
      name: t.team.displayName,
      abbreviation: t.team.abbreviation,
      location: t.team.location,
    })),
  }
}, { method: 'get_teams' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getTeams }

console.log('settlegrid-rugby MCP server ready')
console.log('Methods: get_scoreboard, get_teams')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 185. Golf ──────────────────────────────────────────────────────────────
generateServer({
  slug: 'golf',
  name: 'Golf / PGA Data',
  description: 'PGA Tour golf scores, leaderboards, and rankings from ESPN.',
  keywords: ['sports', 'golf', 'pga', 'leaderboard'],
  upstream: { provider: 'ESPN', baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_scoreboard', displayName: 'Golf Scoreboard', costCents: 1, description: 'Get current golf tournament leaderboard', params: [] },
    { name: 'get_rankings', displayName: 'Golf Rankings', costCents: 1, description: 'Get PGA Tour world rankings', params: [] },
  ],
  serverTs: `/**
 * settlegrid-golf — Golf / PGA Data MCP Server
 *
 * Methods:
 *   get_scoreboard()   — Tournament leaderboard    (1\u00A2)
 *   get_rankings()     — World rankings            (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga'

async function golfFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ESPN Golf API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'golf',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Golf Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'Golf Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await golfFetch<{ events: Array<{ id: string; name: string; date: string; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; score: string; status: { displayValue: string } }> }> }> }>('/scoreboard')
  return {
    count: data.events?.length || 0,
    tournaments: (data.events || []).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      leaderboard: (e.competitions?.[0]?.competitors || []).slice(0, 20).map((c) => ({
        player: c.athlete?.displayName,
        score: c.score,
        status: c.status?.displayValue,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async () => {
  const data = await golfFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string; flag: { alt: string } }; record: { displayValue: string } }> }> | null }>('/rankings')
  const ranking = data.rankings?.[0]
  return {
    name: ranking?.name,
    players: (ranking?.ranks || []).slice(0, 25).map((r) => ({
      rank: r.current,
      name: r.athlete?.displayName,
      country: r.athlete?.flag?.alt,
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-golf MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 186. Cycling ───────────────────────────────────────────────────────────
generateServer({
  slug: 'cycling',
  name: 'Cycling Data',
  description: 'Professional cycling race results and rankings from ESPN.',
  keywords: ['sports', 'cycling', 'tour-de-france', 'racing'],
  upstream: { provider: 'ESPN', baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/racing/cycling', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_scoreboard', displayName: 'Cycling Scoreboard', costCents: 1, description: 'Get current cycling race results', params: [] },
    { name: 'get_rankings', displayName: 'Cycling Rankings', costCents: 1, description: 'Get UCI world rankings', params: [] },
  ],
  serverTs: `/**
 * settlegrid-cycling — Cycling Data MCP Server
 *
 * Methods:
 *   get_scoreboard()   — Race results     (1\u00A2)
 *   get_rankings()     — UCI rankings     (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/racing/cycling'

async function cyclingFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ESPN Cycling API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cycling',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Cycling Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'Cycling Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await cyclingFetch<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; status: { displayValue: string } }> }> }> }>('/scoreboard')
  return {
    count: data.events?.length || 0,
    races: (data.events || []).slice(0, 10).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      results: (e.competitions?.[0]?.competitors || []).slice(0, 15).map((c) => ({
        rider: c.athlete?.displayName,
        result: c.status?.displayValue,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async () => {
  const data = await cyclingFetch<{ rankings: Array<{ name: string; ranks: Array<{ current: number; athlete: { displayName: string; flag: { alt: string } } }> }> | null }>('/rankings')
  const ranking = data.rankings?.[0]
  return {
    name: ranking?.name,
    riders: (ranking?.ranks || []).slice(0, 25).map((r) => ({
      rank: r.current,
      name: r.athlete?.displayName,
      country: r.athlete?.flag?.alt,
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getRankings }

console.log('settlegrid-cycling MCP server ready')
console.log('Methods: get_scoreboard, get_rankings')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 187. Running / Marathon ────────────────────────────────────────────────
generateServer({
  slug: 'running',
  name: 'Running / Marathon Data',
  description: 'Marathon and running race data, event schedules from ESPN.',
  keywords: ['sports', 'running', 'marathon', 'athletics'],
  upstream: { provider: 'ESPN', baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/racing/marathon', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_scoreboard', displayName: 'Running Events', costCents: 1, description: 'Get current running/marathon events', params: [] },
    { name: 'get_track_events', displayName: 'Track Events', costCents: 1, description: 'Get track & field results from ESPN', params: [] },
  ],
  serverTs: `/**
 * settlegrid-running — Running / Marathon Data MCP Server
 *
 * Methods:
 *   get_scoreboard()     — Marathon events       (1\u00A2)
 *   get_track_events()   — Track & field         (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const MARATHON_BASE = 'https://site.api.espn.com/apis/site/v2/sports/racing/marathon'
const TRACK_BASE = 'https://site.api.espn.com/apis/site/v2/sports/olympics/track-and-field'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ESPN API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'running',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Running Events' },
      get_track_events: { costCents: 1, displayName: 'Track Events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async () => {
  const data = await fetchJson<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } }; competitions: Array<{ competitors: Array<{ athlete: { displayName: string }; status: { displayValue: string } }> }> }> }>(\`\${MARATHON_BASE}/scoreboard\`)
  return {
    count: data.events?.length || 0,
    events: (data.events || []).slice(0, 10).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      results: (e.competitions?.[0]?.competitors || []).slice(0, 10).map((c) => ({
        athlete: c.athlete?.displayName,
        result: c.status?.displayValue,
      })),
    })),
  }
}, { method: 'get_scoreboard' })

const getTrackEvents = sg.wrap(async () => {
  const data = await fetchJson<{ events: Array<{ id: string; name: string; date: string; status: { type: { description: string } } }> }>(\`\${TRACK_BASE}/scoreboard\`)
  return {
    count: data.events?.length || 0,
    events: (data.events || []).slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
    })),
  }
}, { method: 'get_track_events' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getTrackEvents }

console.log('settlegrid-running MCP server ready')
console.log('Methods: get_scoreboard, get_track_events')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 188. Esports ───────────────────────────────────────────────────────────
generateServer({
  slug: 'esports',
  name: 'Esports Data (PandaScore)',
  description: 'Esports tournaments, matches, and teams from PandaScore.',
  keywords: ['sports', 'esports', 'gaming', 'tournaments'],
  upstream: { provider: 'PandaScore', baseUrl: 'https://api.pandascore.co', auth: 'Bearer token', rateLimit: '1000 req/hr (free)', docsUrl: 'https://developers.pandascore.co/' },
  auth: { type: 'key', keyEnvVar: 'PANDASCORE_TOKEN', keyDesc: 'PandaScore API token (free at pandascore.co)' },
  methods: [
    { name: 'get_matches', displayName: 'Get Matches', costCents: 2, description: 'Get upcoming/recent esports matches', params: [{ name: 'game', type: 'string', required: false, description: 'Game slug: "lol", "dota2", "csgo", "valorant"' }, { name: 'status', type: 'string', required: false, description: '"upcoming", "running", or "past"' }] },
    { name: 'get_tournaments', displayName: 'Get Tournaments', costCents: 2, description: 'Get esports tournaments', params: [{ name: 'game', type: 'string', required: false, description: 'Game slug' }] },
  ],
  serverTs: `/**
 * settlegrid-esports — Esports Data MCP Server
 *
 * Methods:
 *   get_matches(game?, status?)   — Esports matches       (2\u00A2)
 *   get_tournaments(game?)        — Esports tournaments   (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MatchesInput { game?: string; status?: string }
interface TournamentsInput { game?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.pandascore.co'
const TOKEN = process.env.PANDASCORE_TOKEN || ''

async function pandaFetch<T>(path: string): Promise<T> {
  if (!TOKEN) throw new Error('PANDASCORE_TOKEN environment variable is required')
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { Authorization: \`Bearer \${TOKEN}\` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`PandaScore API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'esports',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_matches: { costCents: 2, displayName: 'Get Matches' },
      get_tournaments: { costCents: 2, displayName: 'Get Tournaments' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMatches = sg.wrap(async (args: MatchesInput) => {
  const validStatus = ['upcoming', 'running', 'past']
  const status = args.status && validStatus.includes(args.status) ? args.status : 'upcoming'
  let path = \`/matches/\${status}?per_page=10\`
  if (args.game) {
    path = \`/\${encodeURIComponent(args.game)}/matches/\${status}?per_page=10\`
  }
  const data = await pandaFetch<Array<{ id: number; name: string; begin_at: string; status: string; league: { name: string }; opponents: Array<{ opponent: { name: string } }>; results: Array<{ team_id: number; score: number }> }>>(path)
  return {
    status,
    game: args.game || 'all',
    matches: data.map((m) => ({
      id: m.id,
      name: m.name,
      startAt: m.begin_at,
      status: m.status,
      league: m.league?.name,
      opponents: m.opponents?.map((o) => o.opponent?.name),
      results: m.results,
    })),
  }
}, { method: 'get_matches' })

const getTournaments = sg.wrap(async (args: TournamentsInput) => {
  let path = '/tournaments?per_page=10&sort=-begin_at'
  if (args.game) {
    path = \`/\${encodeURIComponent(args.game)}/tournaments?per_page=10&sort=-begin_at\`
  }
  const data = await pandaFetch<Array<{ id: number; name: string; begin_at: string; end_at: string; league: { name: string }; serie: { full_name: string }; prizepool: string }>>(path)
  return {
    game: args.game || 'all',
    tournaments: data.map((t) => ({
      id: t.id,
      name: t.name,
      startAt: t.begin_at,
      endAt: t.end_at,
      league: t.league?.name,
      series: t.serie?.full_name,
      prizepool: t.prizepool,
    })),
  }
}, { method: 'get_tournaments' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMatches, getTournaments }

console.log('settlegrid-esports MCP server ready')
console.log('Methods: get_matches, get_tournaments')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 189. Chess ─────────────────────────────────────────────────────────────
generateServer({
  slug: 'chess',
  name: 'Chess Data',
  description: 'Chess player profiles, games, and stats from Chess.com and Lichess.',
  keywords: ['sports', 'chess', 'chess-com', 'lichess'],
  upstream: { provider: 'Chess.com + Lichess', baseUrl: 'https://api.chess.com/pub', auth: 'None required', rateLimit: '100 req/min', docsUrl: 'https://www.chess.com/news/view/published-data-api' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_player', displayName: 'Get Player', costCents: 1, description: 'Get Chess.com player profile and stats', params: [{ name: 'username', type: 'string', required: true, description: 'Chess.com username' }] },
    { name: 'get_player_games', displayName: 'Get Player Games', costCents: 1, description: 'Get recent games for a Chess.com player', params: [{ name: 'username', type: 'string', required: true, description: 'Chess.com username' }] },
    { name: 'get_lichess_player', displayName: 'Lichess Player', costCents: 1, description: 'Get Lichess player profile', params: [{ name: 'username', type: 'string', required: true, description: 'Lichess username' }] },
  ],
  serverTs: `/**
 * settlegrid-chess — Chess Data MCP Server
 *
 * Methods:
 *   get_player(username)         — Chess.com profile     (1\u00A2)
 *   get_player_games(username)   — Recent games          (1\u00A2)
 *   get_lichess_player(username) — Lichess profile       (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlayerInput { username: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const CHESS_BASE = 'https://api.chess.com/pub'
const LICHESS_BASE = 'https://lichess.org/api'

async function chessFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-chess/1.0 (contact@settlegrid.ai)', Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Chess API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateUsername(username: string): string {
  if (!username || typeof username !== 'string') throw new Error('username is required')
  const clean = username.trim().toLowerCase()
  if (!/^[a-z0-9_-]{1,30}$/.test(clean)) throw new Error('Invalid username format')
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chess',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_player: { costCents: 1, displayName: 'Get Player' },
      get_player_games: { costCents: 1, displayName: 'Get Player Games' },
      get_lichess_player: { costCents: 1, displayName: 'Lichess Player' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPlayer = sg.wrap(async (args: PlayerInput) => {
  const user = validateUsername(args.username)
  const [profile, stats] = await Promise.all([
    chessFetch<{ username: string; title?: string; followers: number; country: string; joined: number; last_online: number }>(\`\${CHESS_BASE}/player/\${user}\`),
    chessFetch<{ chess_rapid?: { last: { rating: number }; record: { win: number; loss: number; draw: number } }; chess_blitz?: { last: { rating: number } }; chess_bullet?: { last: { rating: number } } }>(\`\${CHESS_BASE}/player/\${user}/stats\`),
  ])
  return {
    username: profile.username,
    title: profile.title,
    followers: profile.followers,
    joined: new Date(profile.joined * 1000).toISOString(),
    ratings: {
      rapid: stats.chess_rapid?.last?.rating,
      blitz: stats.chess_blitz?.last?.rating,
      bullet: stats.chess_bullet?.last?.rating,
    },
    rapidRecord: stats.chess_rapid?.record,
  }
}, { method: 'get_player' })

const getPlayerGames = sg.wrap(async (args: PlayerInput) => {
  const user = validateUsername(args.username)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const data = await chessFetch<{ games: Array<{ url: string; time_class: string; white: { username: string; rating: number; result: string }; black: { username: string; rating: number; result: string } }> }>(\`\${CHESS_BASE}/player/\${user}/games/\${year}/\${month}\`)
  return {
    username: user,
    count: data.games?.length || 0,
    games: (data.games || []).slice(-10).reverse().map((g) => ({
      url: g.url,
      timeClass: g.time_class,
      white: { username: g.white.username, rating: g.white.rating, result: g.white.result },
      black: { username: g.black.username, rating: g.black.rating, result: g.black.result },
    })),
  }
}, { method: 'get_player_games' })

const getLichessPlayer = sg.wrap(async (args: PlayerInput) => {
  const user = validateUsername(args.username)
  const data = await chessFetch<{ id: string; username: string; title?: string; count: { all: number; win: number; loss: number; draw: number }; perfs: Record<string, { games: number; rating: number }> }>(\`\${LICHESS_BASE}/user/\${user}\`)
  return {
    username: data.username,
    title: data.title,
    totalGames: data.count?.all,
    record: { wins: data.count?.win, losses: data.count?.loss, draws: data.count?.draw },
    ratings: Object.fromEntries(
      Object.entries(data.perfs || {}).map(([k, v]) => [k, { rating: v.rating, games: v.games }])
    ),
  }
}, { method: 'get_lichess_player' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPlayer, getPlayerGames, getLichessPlayer }

console.log('settlegrid-chess MCP server ready')
console.log('Methods: get_player, get_player_games, get_lichess_player')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ─── 190. FIFA Rankings ─────────────────────────────────────────────────────
generateServer({
  slug: 'fifa',
  name: 'FIFA Rankings & Data',
  description: 'FIFA world rankings, competitions, and international football data.',
  keywords: ['sports', 'soccer', 'football', 'fifa', 'rankings'],
  upstream: { provider: 'Football-Data.org', baseUrl: 'https://api.football-data.org/v4', auth: 'API key (header: X-Auth-Token)', rateLimit: '10 req/min (free)', docsUrl: 'https://www.football-data.org/documentation' },
  auth: { type: 'key', keyEnvVar: 'FOOTBALL_DATA_API_KEY', keyDesc: 'Football-Data.org API key (same as football-data server)' },
  methods: [
    { name: 'get_world_cup_standings', displayName: 'World Cup Standings', costCents: 2, description: 'Get FIFA World Cup group standings', params: [] },
    { name: 'get_competition_teams', displayName: 'Competition Teams', costCents: 2, description: 'Get teams in a FIFA competition', params: [{ name: 'competition', type: 'string', required: true, description: 'Competition code: "WC" (World Cup), "EC" (Euro), "CLI" (Copa Libertadores)' }] },
    { name: 'get_competition_matches', displayName: 'Competition Matches', costCents: 2, description: 'Get matches in a FIFA competition', params: [{ name: 'competition', type: 'string', required: true, description: 'Competition code' }] },
  ],
  serverTs: `/**
 * settlegrid-fifa — FIFA Rankings & Data MCP Server
 *
 * Methods:
 *   get_world_cup_standings()                 — WC standings       (2\u00A2)
 *   get_competition_teams(competition)        — Competition teams  (2\u00A2)
 *   get_competition_matches(competition)      — Competition matches(2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompInput { competition: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || ''

async function fifaFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('FOOTBALL_DATA_API_KEY environment variable is required')
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Football-Data API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const VALID_COMPS = new Set(['WC', 'EC', 'CLI', 'CL', 'BSA'])

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fifa',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_world_cup_standings: { costCents: 2, displayName: 'World Cup Standings' },
      get_competition_teams: { costCents: 2, displayName: 'Competition Teams' },
      get_competition_matches: { costCents: 2, displayName: 'Competition Matches' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getWorldCupStandings = sg.wrap(async () => {
  const data = await fifaFetch<{ competition: { name: string }; standings: Array<{ group: string; table: Array<{ position: number; team: { name: string; crest: string }; playedGames: number; won: number; draw: number; lost: number; points: number; goalsFor: number; goalsAgainst: number }> }> }>('/competitions/WC/standings')
  return {
    competition: data.competition?.name,
    groups: (data.standings || []).map((g) => ({
      group: g.group,
      table: g.table?.map((t) => ({
        position: t.position,
        team: t.team?.name,
        played: t.playedGames,
        won: t.won,
        drawn: t.draw,
        lost: t.lost,
        points: t.points,
        gf: t.goalsFor,
        ga: t.goalsAgainst,
      })),
    })),
  }
}, { method: 'get_world_cup_standings' })

const getCompetitionTeams = sg.wrap(async (args: CompInput) => {
  if (!args.competition) throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  if (!VALID_COMPS.has(code)) throw new Error(\`Valid competitions: \${[...VALID_COMPS].join(', ')}\`)
  const data = await fifaFetch<{ competition: { name: string }; teams: Array<{ id: number; name: string; shortName: string; crest: string; venue: string }> }>(\`/competitions/\${code}/teams\`)
  return {
    competition: data.competition?.name,
    count: data.teams?.length || 0,
    teams: (data.teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      crest: t.crest,
      venue: t.venue,
    })),
  }
}, { method: 'get_competition_teams' })

const getCompetitionMatches = sg.wrap(async (args: CompInput) => {
  if (!args.competition) throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  const data = await fifaFetch<{ matches: Array<{ id: number; utcDate: string; status: string; matchday: number; stage: string; homeTeam: { name: string }; awayTeam: { name: string }; score: { fullTime: { home: number | null; away: number | null } } }> }>(\`/competitions/\${code}/matches\`)
  return {
    competition: code,
    count: data.matches?.length || 0,
    matches: (data.matches || []).slice(0, 20).map((m) => ({
      id: m.id,
      date: m.utcDate,
      status: m.status,
      matchday: m.matchday,
      stage: m.stage,
      homeTeam: m.homeTeam?.name,
      awayTeam: m.awayTeam?.name,
      homeScore: m.score?.fullTime?.home,
      awayScore: m.score?.fullTime?.away,
    })),
  }
}, { method: 'get_competition_matches' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getWorldCupStandings, getCompetitionTeams, getCompetitionMatches }

console.log('settlegrid-fifa MCP server ready')
console.log('Methods: get_world_cup_standings, get_competition_teams, get_competition_matches')
console.log('Pricing: 2\u00A2 per call | Powered by SettleGrid')
`,
})

console.log('\n=== Done! 38 new servers generated (2 skipped: pokeapi, cocktaildb already exist) ===\n')
