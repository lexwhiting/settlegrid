/**
 * batch-remaining-2.mjs — 30 Entertainment + Sports MCP servers (compact auto-generator)
 *
 * Entertainment (18): tmdb, omdb, tvmaze, spotify-metadata, musicbrainz, igdb, rawg,
 *   boardgame-atlas, opentdb, jservice, chuck-norris, dad-jokes, catfact, dog-ceo,
 *   swapi, superhero, harry-potter, anime
 *
 * Sports (12): football-data, api-football, nba-stats, mlb-stats, nhl-stats, f1-data,
 *   cricket, thesportsdb, balldontlie, nfl-data, olympics, ufc-data
 *
 * Run: cd /Users/lex/settlegrid && node scripts/batch-remaining-2.mjs
 */

import { G, M } from './lib/generate-auto.mjs'

console.log('\n=== Entertainment Servers (18) ===\n')

// ─── 1. TMDB ────────────────────────────────────────────────────────────────

G('tmdb', 'TMDB (The Movie Database)', 'Search movies, TV shows, and people via The Movie Database API.',
  'https://api.themoviedb.org/3',
  { q: 'api_key', e: 'TMDB_API_KEY', d: 'Free key from themoviedb.org' },
  { p: 'TMDB', u: 'https://api.themoviedb.org/3', r: '~40 req/10s', docs: 'https://developer.themoviedb.org/docs' },
  ['entertainment', 'movies', 'tv', 'tmdb'],
  [
    M('search_movies', 'Search Movies', 2, 'Search movies by title',
      [{s: 'query'}], '/search/movie?query=${query}', {l: 'results', f: ['id', 'title', 'release_date', 'overview', 'vote_average'], m: 10}),
    M('get_movie', 'Get Movie', 2, 'Get movie details by ID',
      [{n: 'id'}], '/movie/${id}', {f: ['id', 'title', 'release_date', 'overview', 'vote_average', 'runtime', 'genres']}),
    M('search_tv', 'Search TV Shows', 2, 'Search TV shows by name',
      [{s: 'query'}], '/search/tv?query=${query}', {l: 'results', f: ['id', 'name', 'first_air_date', 'overview', 'vote_average'], m: 10}),
  ])

// ─── 2. OMDB ────────────────────────────────────────────────────────────────

G('omdb', 'OMDb (Open Movie Database)', 'Search and retrieve movie data from the Open Movie Database.',
  'https://www.omdbapi.com',
  { q: 'apikey', e: 'OMDB_API_KEY', d: 'Free key from omdbapi.com (1000 req/day)' },
  { p: 'OMDb', u: 'https://www.omdbapi.com', r: '1000 req/day (free)', docs: 'https://www.omdbapi.com/' },
  ['entertainment', 'movies', 'omdb'],
  [
    M('search_movies', 'Search Movies', 2, 'Search movies by title',
      [{s: 'query'}], '/?s=${query}', {l: 'Search', f: ['Title', 'Year', 'imdbID', 'Type', 'Poster'], m: 10}),
    M('get_movie', 'Get Movie', 2, 'Get movie details by IMDb ID or title',
      [{s: 'query'}], '/?t=${query}&plot=short', {f: ['Title', 'Year', 'Rated', 'Runtime', 'Genre', 'Director', 'Plot', 'imdbRating']}),
  ])

// ─── 3. TVMaze ──────────────────────────────────────────────────────────────

G('tvmaze', 'TVMaze', 'Search TV shows, get episode guides, and scheduling data.',
  'https://api.tvmaze.com',
  {},
  { p: 'TVMaze', u: 'https://api.tvmaze.com', r: '20 req/10s', docs: 'https://www.tvmaze.com/api' },
  ['entertainment', 'tv', 'tvmaze'],
  [
    M('search_shows', 'Search Shows', 1, 'Search TV shows by name',
      [{s: 'query'}], '/search/shows?q=${query}', {f: ['score', 'show'], m: 10}),
    M('get_show', 'Get Show', 1, 'Get TV show details by ID',
      [{n: 'id'}], '/shows/${id}', {f: ['id', 'name', 'language', 'genres', 'status', 'rating', 'premiered']}),
    M('get_episodes', 'Get Episodes', 1, 'Get all episodes for a show',
      [{n: 'show_id'}], '/shows/${show_id}/episodes', {f: ['id', 'name', 'season', 'number', 'airdate'], m: 10}),
  ])

// ─── 4. Spotify Metadata ────────────────────────────────────────────────────

G('spotify-metadata', 'Spotify Metadata', 'Search tracks, albums, and artists via the Spotify Web API.',
  'https://api.spotify.com/v1',
  { b: true, e: 'SPOTIFY_ACCESS_TOKEN', d: 'Spotify OAuth token from developer.spotify.com' },
  { p: 'Spotify', u: 'https://api.spotify.com/v1', r: 'Rate-limited per app', docs: 'https://developer.spotify.com/documentation/web-api' },
  ['entertainment', 'music', 'spotify'],
  [
    M('search_tracks', 'Search Tracks', 2, 'Search for tracks by name',
      [{s: 'query'}], '/search?q=${query}&type=track&limit=10', {l: 'tracks.items', f: ['id', 'name', 'artists', 'album', 'duration_ms'], m: 10}),
    M('search_artists', 'Search Artists', 2, 'Search for artists by name',
      [{s: 'query'}], '/search?q=${query}&type=artist&limit=10', {l: 'artists.items', f: ['id', 'name', 'genres', 'popularity', 'followers'], m: 10}),
    M('get_track', 'Get Track', 2, 'Get track details by Spotify ID',
      [{s: 'id'}], '/tracks/${id}', {f: ['id', 'name', 'artists', 'album', 'duration_ms', 'popularity']}),
  ])

// ─── 5. MusicBrainz ────────────────────────────────────────────────────────

G('musicbrainz', 'MusicBrainz', 'Search music metadata — artists, releases, and recordings from the MusicBrainz database.',
  'https://musicbrainz.org/ws/2',
  {},
  { p: 'MusicBrainz', u: 'https://musicbrainz.org/ws/2', r: '1 req/sec', docs: 'https://musicbrainz.org/doc/MusicBrainz_API' },
  ['entertainment', 'music', 'musicbrainz'],
  [
    M('search_artists', 'Search Artists', 1, 'Search artists by name',
      [{s: 'query'}], '/artist/?query=${query}&fmt=json&limit=10', {l: 'artists', f: ['id', 'name', 'type', 'country', 'life-span'], m: 10}),
    M('search_releases', 'Search Releases', 1, 'Search album/single releases by title',
      [{s: 'query'}], '/release/?query=${query}&fmt=json&limit=10', {l: 'releases', f: ['id', 'title', 'date', 'country', 'status'], m: 10}),
    M('search_recordings', 'Search Recordings', 1, 'Search recordings (tracks) by title',
      [{s: 'query'}], '/recording/?query=${query}&fmt=json&limit=10', {l: 'recordings', f: ['id', 'title', 'length', 'artist-credit'], m: 10}),
  ])

// ─── 6. IGDB ────────────────────────────────────────────────────────────────

G('igdb', 'IGDB (Internet Game Database)', 'Search video game data — titles, ratings, platforms via the IGDB API.',
  'https://api.igdb.com/v4',
  { h: 'Authorization', e: 'IGDB_BEARER_TOKEN', d: 'Twitch Client Credentials OAuth token for IGDB' },
  { p: 'IGDB / Twitch', u: 'https://api.igdb.com/v4', r: '4 req/sec', docs: 'https://api-docs.igdb.com/' },
  ['entertainment', 'games', 'igdb'],
  [
    M('search_games', 'Search Games', 2, 'Search video games by name',
      [{s: 'query'}], '/games?search=${query}&fields=id,name,rating,first_release_date,platforms,summary&limit=10', {f: ['id', 'name', 'rating', 'first_release_date', 'summary'], m: 10}),
    M('get_game', 'Get Game', 2, 'Get game details by ID',
      [{n: 'id'}], '/games/${id}?fields=id,name,rating,summary,storyline,genres,platforms,first_release_date', {f: ['id', 'name', 'rating', 'summary', 'genres', 'platforms']}),
  ])

// ─── 7. RAWG ────────────────────────────────────────────────────────────────

G('rawg', 'RAWG Video Games', 'Search and browse video game data from the RAWG database.',
  'https://api.rawg.io/api',
  { q: 'key', e: 'RAWG_API_KEY', d: 'Free key from rawg.io/apidocs' },
  { p: 'RAWG', u: 'https://api.rawg.io/api', r: '20 req/sec', docs: 'https://rawg.io/apidocs' },
  ['entertainment', 'games', 'rawg'],
  [
    M('search_games', 'Search Games', 2, 'Search video games by name',
      [{s: 'query'}], '/games?search=${query}&page_size=10', {l: 'results', f: ['id', 'name', 'released', 'rating', 'metacritic', 'platforms'], m: 10}),
    M('get_game', 'Get Game', 2, 'Get game details by ID or slug',
      [{s: 'id'}], '/games/${id}', {f: ['id', 'name', 'released', 'rating', 'metacritic', 'description_raw', 'platforms', 'genres']}),
  ])

// ─── 8. Board Game Atlas ────────────────────────────────────────────────────

G('boardgame-atlas', 'Board Game Atlas', 'Search board games, mechanics, and categories from Board Game Atlas.',
  'https://api.boardgameatlas.com/api',
  { q: 'client_id', e: 'BGA_CLIENT_ID', d: 'Free client ID from boardgameatlas.com/api/docs' },
  { p: 'Board Game Atlas', u: 'https://api.boardgameatlas.com/api', r: 'Reasonable use', docs: 'https://www.boardgameatlas.com/api/docs' },
  ['entertainment', 'boardgames'],
  [
    M('search_games', 'Search Games', 2, 'Search board games by name',
      [{s: 'query'}], '/search?name=${query}&limit=10', {l: 'games', f: ['id', 'name', 'year_published', 'min_players', 'max_players', 'average_user_rating', 'description_preview'], m: 10}),
    M('get_game', 'Get Game', 2, 'Get board game details by ID',
      [{s: 'id'}], '/search?ids=${id}', {l: 'games', f: ['id', 'name', 'year_published', 'min_players', 'max_players', 'average_user_rating', 'description_preview', 'mechanics'], m: 1}),
  ])

// ─── 9. Open Trivia DB ─────────────────────────────────────────────────────

G('opentdb', 'Open Trivia Database', 'Get random trivia questions from the Open Trivia Database.',
  'https://opentdb.com',
  {},
  { p: 'Open Trivia DB', u: 'https://opentdb.com', r: '1 req/5s', docs: 'https://opentdb.com/api_config.php' },
  ['entertainment', 'trivia', 'quiz'],
  [
    M('get_questions', 'Get Questions', 1, 'Get random trivia questions',
      [{on: 'amount'}, {os: 'difficulty'}], '/api.php?amount=${amount}&difficulty=${difficulty}', {l: 'results', f: ['category', 'type', 'difficulty', 'question', 'correct_answer', 'incorrect_answers'], m: 10}),
    M('get_categories', 'Get Categories', 1, 'List all trivia categories',
      [], '/api_category.php', {l: 'trivia_categories', f: ['id', 'name'], m: 50}),
  ])

// ─── 10. jService ───────────────────────────────────────────────────────────

G('jservice', 'jService (Jeopardy)', 'Get Jeopardy-style trivia clues from the jService API.',
  'https://jservice.io/api',
  {},
  { p: 'jService', u: 'https://jservice.io', r: 'Reasonable use', docs: 'https://jservice.io/' },
  ['entertainment', 'trivia', 'jeopardy'],
  [
    M('get_random', 'Random Clues', 1, 'Get random Jeopardy clues',
      [{on: 'count'}], '/random?count=${count}', {f: ['id', 'answer', 'question', 'value', 'category'], m: 10}),
    M('get_clues', 'Get Clues', 1, 'Get clues by category ID',
      [{n: 'category'}], '/clues?category=${category}', {f: ['id', 'answer', 'question', 'value', 'airdate'], m: 10}),
  ])

// ─── 11. Chuck Norris ───────────────────────────────────────────────────────

G('chuck-norris', 'Chuck Norris Jokes', 'Get random Chuck Norris jokes from the Chuck Norris API.',
  'https://api.chucknorris.io/jokes',
  {},
  { p: 'chucknorris.io', u: 'https://api.chucknorris.io', r: 'Unlimited', docs: 'https://api.chucknorris.io/' },
  ['entertainment', 'jokes', 'humor'],
  [
    M('get_random', 'Random Joke', 1, 'Get a random Chuck Norris joke',
      [], '/random', {f: ['id', 'value', 'categories', 'url']}),
    M('search_jokes', 'Search Jokes', 1, 'Search jokes by keyword',
      [{s: 'query'}], '/search?query=${query}', {l: 'result', f: ['id', 'value', 'categories'], m: 10}),
  ])

// ─── 12. Dad Jokes ──────────────────────────────────────────────────────────

G('dad-jokes', 'Dad Jokes', 'Get dad jokes from the icanhazdadjoke API.',
  'https://icanhazdadjoke.com',
  {},
  { p: 'icanhazdadjoke', u: 'https://icanhazdadjoke.com', r: '100 req/min', docs: 'https://icanhazdadjoke.com/api' },
  ['entertainment', 'jokes', 'humor'],
  [
    M('get_random', 'Random Joke', 1, 'Get a random dad joke',
      [], '/', {f: ['id', 'joke', 'status']}),
    M('search_jokes', 'Search Jokes', 1, 'Search dad jokes by term',
      [{s: 'term'}], '/search?term=${term}&limit=10', {l: 'results', f: ['id', 'joke'], m: 10}),
  ])

// ─── 13. Cat Facts ──────────────────────────────────────────────────────────

G('catfact', 'Cat Facts', 'Get random cat facts from the Cat Fact API.',
  'https://catfact.ninja',
  {},
  { p: 'Cat Fact Ninja', u: 'https://catfact.ninja', r: 'Unlimited', docs: 'https://catfact.ninja/' },
  ['entertainment', 'animals', 'cats'],
  [
    M('get_fact', 'Random Fact', 1, 'Get a random cat fact',
      [], '/fact', {f: ['fact', 'length']}),
    M('get_breeds', 'Get Breeds', 1, 'List cat breeds',
      [], '/breeds?limit=10', {l: 'data', f: ['breed', 'country', 'origin', 'coat', 'pattern'], m: 10}),
  ])

// ─── 14. Dog CEO ────────────────────────────────────────────────────────────

G('dog-ceo', 'Dog CEO', 'Get random dog images and breed lists from the Dog CEO API.',
  'https://dog.ceo/api',
  {},
  { p: 'Dog CEO', u: 'https://dog.ceo/api', r: 'Unlimited', docs: 'https://dog.ceo/dog-api/' },
  ['entertainment', 'animals', 'dogs'],
  [
    M('random_image', 'Random Image', 1, 'Get a random dog image URL',
      [], '/breeds/image/random', {f: ['message', 'status']}),
    M('list_breeds', 'List Breeds', 1, 'List all dog breeds',
      [], '/breeds/list/all', {f: ['message', 'status']}),
    M('breed_images', 'Breed Images', 1, 'Get random images for a specific breed',
      [{s: 'breed'}], '/breed/${breed}/images/random/3', {f: ['message', 'status']}),
  ])

// ─── 15. SWAPI ──────────────────────────────────────────────────────────────

G('swapi', 'SWAPI (Star Wars)', 'Search Star Wars people, planets, starships, and films.',
  'https://swapi.dev/api',
  {},
  { p: 'SWAPI', u: 'https://swapi.dev/api', r: '10,000 req/day', docs: 'https://swapi.dev/documentation' },
  ['entertainment', 'starwars', 'movies'],
  [
    M('search_people', 'Search People', 1, 'Search Star Wars characters by name',
      [{s: 'query'}], '/people/?search=${query}', {l: 'results', f: ['name', 'height', 'mass', 'birth_year', 'gender', 'homeworld'], m: 10}),
    M('search_planets', 'Search Planets', 1, 'Search Star Wars planets by name',
      [{s: 'query'}], '/planets/?search=${query}', {l: 'results', f: ['name', 'climate', 'terrain', 'population', 'diameter'], m: 10}),
    M('search_starships', 'Search Starships', 1, 'Search Star Wars starships by name',
      [{s: 'query'}], '/starships/?search=${query}', {l: 'results', f: ['name', 'model', 'manufacturer', 'crew', 'passengers', 'hyperdrive_rating'], m: 10}),
  ])

// ─── 16. Superhero ──────────────────────────────────────────────────────────

G('superhero', 'Superhero API', 'Browse superhero data — powerstats, biography, and images.',
  'https://akabab.github.io/superhero-api/api',
  {},
  { p: 'Superhero API', u: 'https://akabab.github.io/superhero-api', r: 'Unlimited (static JSON)', docs: 'https://akabab.github.io/superhero-api/api' },
  ['entertainment', 'superheroes', 'comics'],
  [
    M('get_all', 'Get All Heroes', 1, 'Get full list of superheroes',
      [], '/all.json', {f: ['id', 'name', 'powerstats', 'appearance', 'biography'], m: 20}),
    M('get_hero', 'Get Hero', 1, 'Get superhero details by ID',
      [{n: 'id'}], '/id/${id}.json', {f: ['id', 'name', 'powerstats', 'appearance', 'biography', 'images']}),
  ])

// ─── 17. Harry Potter ───────────────────────────────────────────────────────

G('harry-potter', 'Harry Potter API', 'Get Harry Potter character data from the HP API.',
  'https://hp-api.onrender.com/api',
  {},
  { p: 'HP API', u: 'https://hp-api.onrender.com/api', r: 'Unlimited', docs: 'https://hp-api.onrender.com/' },
  ['entertainment', 'harrypotter', 'books'],
  [
    M('get_characters', 'Get Characters', 1, 'Get all Harry Potter characters',
      [], '/characters', {f: ['name', 'house', 'species', 'wizard', 'ancestry', 'patronus', 'actor'], m: 20}),
    M('get_students', 'Get Students', 1, 'Get Hogwarts students only',
      [], '/characters/students', {f: ['name', 'house', 'species', 'wizard', 'ancestry', 'patronus'], m: 20}),
    M('get_staff', 'Get Staff', 1, 'Get Hogwarts staff only',
      [], '/characters/staff', {f: ['name', 'house', 'species', 'wizard', 'ancestry', 'patronus'], m: 20}),
  ])

// ─── 18. Anime (Jikan) ─────────────────────────────────────────────────────

G('anime', 'Jikan (Anime/Manga)', 'Search anime and manga data via the Jikan MyAnimeList API.',
  'https://api.jikan.moe/v4',
  {},
  { p: 'Jikan / MyAnimeList', u: 'https://api.jikan.moe/v4', r: '3 req/sec', docs: 'https://docs.api.jikan.moe/' },
  ['entertainment', 'anime', 'manga'],
  [
    M('search_anime', 'Search Anime', 1, 'Search anime by title',
      [{s: 'query'}], '/anime?q=${query}&limit=10', {l: 'data', f: ['mal_id', 'title', 'score', 'episodes', 'status', 'synopsis'], m: 10}),
    M('search_manga', 'Search Manga', 1, 'Search manga by title',
      [{s: 'query'}], '/manga?q=${query}&limit=10', {l: 'data', f: ['mal_id', 'title', 'score', 'chapters', 'status', 'synopsis'], m: 10}),
    M('get_anime', 'Get Anime', 1, 'Get anime details by MyAnimeList ID',
      [{n: 'id'}], '/anime/${id}', {l: 'data', f: ['mal_id', 'title', 'score', 'episodes', 'status', 'synopsis', 'genres']}),
  ])


console.log('\n=== Sports Servers (12) ===\n')

// ─── 19. Football-Data ──────────────────────────────────────────────────────

G('football-data', 'Football-Data.org', 'Soccer data — leagues, standings, fixtures, and scorers.',
  'https://api.football-data.org/v4',
  { h: 'X-Auth-Token', e: 'FOOTBALL_DATA_KEY', d: 'Free key from football-data.org' },
  { p: 'football-data.org', u: 'https://api.football-data.org/v4', r: '10 req/min (free)', docs: 'https://www.football-data.org/documentation' },
  ['sports', 'soccer', 'football'],
  [
    M('get_competitions', 'Get Competitions', 2, 'List available soccer competitions',
      [], '/competitions', {l: 'competitions', f: ['id', 'name', 'code', 'area', 'currentSeason'], m: 15}),
    M('get_standings', 'Get Standings', 2, 'Get league standings by competition code',
      [{s: 'competition'}], '/competitions/${competition}/standings', {l: 'standings', f: ['stage', 'type', 'table'], m: 5}),
    M('get_matches', 'Get Matches', 2, 'Get matches for a competition',
      [{s: 'competition'}], '/competitions/${competition}/matches?limit=10', {l: 'matches', f: ['id', 'utcDate', 'status', 'homeTeam', 'awayTeam', 'score'], m: 10}),
  ])

// ─── 20. API-Football ───────────────────────────────────────────────────────

G('api-football', 'API-Football', 'Comprehensive football/soccer data — fixtures, standings, and statistics.',
  'https://v3.football.api-sports.io',
  { h: 'x-apisports-key', e: 'API_FOOTBALL_KEY', d: 'Free key from api-sports.io (100 req/day)' },
  { p: 'API-Sports', u: 'https://v3.football.api-sports.io', r: '100 req/day (free)', docs: 'https://www.api-football.com/documentation-v3' },
  ['sports', 'soccer', 'football'],
  [
    M('get_leagues', 'Get Leagues', 2, 'List available football leagues',
      [], '/leagues', {l: 'response', f: ['league', 'country', 'seasons'], m: 15}),
    M('get_standings', 'Get Standings', 2, 'Get league standings by league and season',
      [{n: 'league'}, {n: 'season'}], '/standings?league=${league}&season=${season}', {l: 'response', f: ['league', 'standings'], m: 5}),
    M('get_fixtures', 'Get Fixtures', 2, 'Get fixtures for a league and season',
      [{n: 'league'}, {n: 'season'}], '/fixtures?league=${league}&season=${season}&last=10', {l: 'response', f: ['fixture', 'teams', 'goals', 'score'], m: 10}),
  ])

// ─── 21. NBA Stats (Ball Don't Lie v1) ─────────────────────────────────────

G('nba-stats', 'NBA Stats', 'NBA player and team statistics from the BallDontLie API.',
  'https://www.balldontlie.io/api/v1',
  {},
  { p: 'BallDontLie', u: 'https://www.balldontlie.io', r: '30 req/min', docs: 'https://www.balldontlie.io/home.html#introduction' },
  ['sports', 'basketball', 'nba'],
  [
    M('search_players', 'Search Players', 1, 'Search NBA players by name',
      [{s: 'query'}], '/players?search=${query}&per_page=10', {l: 'data', f: ['id', 'first_name', 'last_name', 'position', 'team'], m: 10}),
    M('get_teams', 'Get Teams', 1, 'List all NBA teams',
      [], '/teams', {l: 'data', f: ['id', 'full_name', 'abbreviation', 'city', 'conference', 'division'], m: 30}),
  ])

// ─── 22. MLB Stats ──────────────────────────────────────────────────────────

G('mlb-stats', 'MLB Stats', 'Major League Baseball data — teams, rosters, and schedules.',
  'https://statsapi.mlb.com/api/v1',
  {},
  { p: 'MLB Stats API', u: 'https://statsapi.mlb.com/api/v1', r: 'Reasonable use', docs: 'https://statsapi.mlb.com/docs/' },
  ['sports', 'baseball', 'mlb'],
  [
    M('get_teams', 'Get Teams', 1, 'List MLB teams',
      [], '/teams?sportId=1', {l: 'teams', f: ['id', 'name', 'abbreviation', 'league', 'division', 'venue'], m: 30}),
    M('get_schedule', 'Get Schedule', 1, 'Get game schedule for a date',
      [{s: 'date'}], '/schedule?sportId=1&date=${date}', {l: 'dates', f: ['date', 'games'], m: 5}),
    M('get_standings', 'Get Standings', 1, 'Get MLB standings by league',
      [{s: 'league_id'}], '/standings?leagueId=${league_id}', {l: 'records', f: ['standingsType', 'teamRecords'], m: 10}),
  ])

// ─── 23. NHL Stats ──────────────────────────────────────────────────────────

G('nhl-stats', 'NHL Stats', 'National Hockey League data — teams, standings, and schedules.',
  'https://api-web.nhle.com/v1',
  {},
  { p: 'NHL Web API', u: 'https://api-web.nhle.com/v1', r: 'Reasonable use', docs: 'https://api-web.nhle.com/' },
  ['sports', 'hockey', 'nhl'],
  [
    M('get_standings', 'Get Standings', 1, 'Get current NHL standings',
      [], '/standings/now', {l: 'standings', f: ['teamAbbrev', 'teamName', 'gamesPlayed', 'wins', 'losses', 'points'], m: 32}),
    M('get_scores', 'Get Scores', 1, 'Get scores for a specific date',
      [{s: 'date'}], '/score/${date}', {l: 'games', f: ['id', 'startTimeUTC', 'awayTeam', 'homeTeam', 'gameState'], m: 15}),
  ])

// ─── 24. F1 Data (Ergast) ───────────────────────────────────────────────────

G('f1-data', 'Formula 1 (Ergast)', 'Formula 1 race data — drivers, constructors, and race results.',
  'https://ergast.com/api/f1',
  {},
  { p: 'Ergast', u: 'https://ergast.com/api/f1', r: '4 req/sec', docs: 'https://ergast.com/mrd/' },
  ['sports', 'racing', 'f1'],
  [
    M('get_drivers', 'Get Drivers', 1, 'Get current season F1 drivers',
      [], '/current/drivers.json', {l: 'MRData.DriverTable.Drivers', f: ['driverId', 'givenName', 'familyName', 'nationality', 'permanentNumber'], m: 25}),
    M('get_constructors', 'Get Constructors', 1, 'Get current season constructors',
      [], '/current/constructors.json', {l: 'MRData.ConstructorTable.Constructors', f: ['constructorId', 'name', 'nationality', 'url'], m: 15}),
    M('get_results', 'Get Results', 1, 'Get results for a specific race in a season',
      [{s: 'season'}, {s: 'round'}], '/${season}/${round}/results.json', {l: 'MRData.RaceTable.Races', f: ['raceName', 'date', 'Circuit', 'Results'], m: 1}),
  ])

// ─── 25. Cricket ────────────────────────────────────────────────────────────

G('cricket', 'Cricket API', 'Cricket data — live scores, matches, and player stats.',
  'https://api.cricapi.com/v1',
  { q: 'apikey', e: 'CRICKET_API_KEY', d: 'Free key from cricapi.com (100 req/day)' },
  { p: 'CricAPI', u: 'https://api.cricapi.com/v1', r: '100 req/day (free)', docs: 'https://cricapi.com/' },
  ['sports', 'cricket'],
  [
    M('get_matches', 'Get Matches', 2, 'Get current and recent cricket matches',
      [], '/currentMatches', {l: 'data', f: ['id', 'name', 'matchType', 'status', 'venue', 'teams', 'score'], m: 10}),
    M('search_players', 'Search Players', 2, 'Search cricket players by name',
      [{s: 'query'}], '/players?search=${query}', {l: 'data', f: ['id', 'name', 'country'], m: 10}),
  ])

// ─── 26. TheSportsDB ───────────────────────────────────────────────────────

G('thesportsdb', 'TheSportsDB', 'Multi-sport data — teams, players, events across all major sports.',
  'https://www.thesportsdb.com/api/v1/json/3',
  {},
  { p: 'TheSportsDB', u: 'https://www.thesportsdb.com', r: '30 req/min (free)', docs: 'https://www.thesportsdb.com/api.php' },
  ['sports', 'multi-sport'],
  [
    M('search_teams', 'Search Teams', 1, 'Search sports teams by name',
      [{s: 'query'}], '/searchteams.php?t=${query}', {l: 'teams', f: ['idTeam', 'strTeam', 'strLeague', 'strSport', 'strCountry', 'strStadium'], m: 10}),
    M('search_players', 'Search Players', 1, 'Search players by name',
      [{s: 'query'}], '/searchplayers.php?p=${query}', {l: 'player', f: ['idPlayer', 'strPlayer', 'strTeam', 'strNationality', 'strPosition', 'strSport'], m: 10}),
    M('get_events', 'Get Events', 1, 'Get past events for a league by round',
      [{s: 'league_id'}, {s: 'round'}], '/eventsround.php?id=${league_id}&r=${round}', {l: 'events', f: ['idEvent', 'strEvent', 'strHomeTeam', 'strAwayTeam', 'intHomeScore', 'intAwayScore', 'dateEvent'], m: 15}),
  ])

// ─── 27. BallDontLie (v2) ──────────────────────────────────────────────────

G('balldontlie', 'BallDontLie (NBA)', 'NBA player stats, season averages, and game data.',
  'https://api.balldontlie.io/v1',
  {},
  { p: 'BallDontLie', u: 'https://api.balldontlie.io', r: '30 req/min', docs: 'https://www.balldontlie.io/home.html' },
  ['sports', 'basketball', 'nba'],
  [
    M('search_players', 'Search Players', 1, 'Search NBA players by name',
      [{s: 'query'}], '/players?search=${query}&per_page=10', {l: 'data', f: ['id', 'first_name', 'last_name', 'position', 'team'], m: 10}),
    M('get_games', 'Get Games', 1, 'Get NBA games by date',
      [{s: 'date'}], '/games?dates[]=${date}&per_page=15', {l: 'data', f: ['id', 'date', 'home_team', 'visitor_team', 'home_team_score', 'visitor_team_score'], m: 15}),
  ])

// ─── 28. NFL Data (ESPN) ────────────────────────────────────────────────────

G('nfl-data', 'NFL Data (ESPN)', 'NFL football data — teams, scores, and standings via ESPN API.',
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
  {},
  { p: 'ESPN', u: 'https://site.api.espn.com', r: 'Reasonable use', docs: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  ['sports', 'football', 'nfl'],
  [
    M('get_scoreboard', 'Get Scoreboard', 1, 'Get current/recent NFL scores',
      [], '/scoreboard', {l: 'events', f: ['id', 'name', 'shortName', 'date', 'status', 'competitions'], m: 16}),
    M('get_teams', 'Get Teams', 1, 'List all NFL teams',
      [], '/teams', {l: 'sports[0].leagues[0].teams', f: ['team'], m: 32}),
    M('get_news', 'Get News', 1, 'Get latest NFL news headlines',
      [], '/news', {l: 'articles', f: ['headline', 'description', 'published', 'links'], m: 10}),
  ])

// ─── 29. Olympics ───────────────────────────────────────────────────────────

G('olympics', 'Olympic Games', 'Olympic Games data — events, athletes, countries, and disciplines.',
  'https://apis.codante.io/olympic-games',
  {},
  { p: 'Codante', u: 'https://apis.codante.io/olympic-games', r: 'Reasonable use', docs: 'https://docs.codante.io/olympic-games' },
  ['sports', 'olympics'],
  [
    M('get_events', 'Get Events', 1, 'Get Olympic events',
      [], '/events', {l: 'data', f: ['id', 'sport', 'discipline', 'event', 'venue', 'date'], m: 20}),
    M('get_countries', 'Get Countries', 1, 'Get participating countries and medal counts',
      [], '/countries', {l: 'data', f: ['id', 'name', 'continent', 'gold', 'silver', 'bronze', 'total'], m: 30}),
  ])

// ─── 30. UFC Data (ESPN) ────────────────────────────────────────────────────

G('ufc-data', 'UFC Data (ESPN)', 'UFC mixed martial arts data — events, fighters, and results via ESPN API.',
  'https://site.api.espn.com/apis/site/v2/sports/mma/ufc',
  {},
  { p: 'ESPN', u: 'https://site.api.espn.com', r: 'Reasonable use', docs: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  ['sports', 'mma', 'ufc'],
  [
    M('get_scoreboard', 'Get Scoreboard', 1, 'Get current/recent UFC event scores',
      [], '/scoreboard', {l: 'events', f: ['id', 'name', 'shortName', 'date', 'status', 'competitions'], m: 10}),
    M('get_news', 'Get News', 1, 'Get latest UFC news headlines',
      [], '/news', {l: 'articles', f: ['headline', 'description', 'published', 'links'], m: 10}),
  ])


console.log('\n=== Done: 30 servers generated ===\n')
