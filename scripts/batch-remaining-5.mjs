/**
 * batch-remaining-5.mjs — 30 SettleGrid MCP servers (News/Media + Utilities/Misc)
 *
 * News/Media (15): newsapi, gnews, mediastack, worldnewsapi, currents, newsdata,
 *   guardian, nyt, bbc-news, podcast-index, listennotes, reddit-news, rss-parser,
 *   eventbrite, meetup
 *
 * Utilities/Misc (15): ipify, user-agent, password-gen, uuid-gen, hash, base64,
 *   markdown, color, placeholder, avatar, barcode-gen, pdf-gen, email-validate,
 *   phone-validate, domain-check
 *
 * Run: cd /Users/lex/settlegrid && node scripts/batch-remaining-5.mjs
 */

import { G, M } from './lib/generate-auto.mjs'

console.log('\n=== News/Media (15 servers) ===\n')

// ─── 1. newsapi ─────────────────────────────────────────────────────────────

G('newsapi', 'NewsAPI', 'Search news articles from 80,000+ sources worldwide via NewsAPI.', 'https://newsapi.org/v2',
  { q: 'apiKey', e: 'NEWSAPI_KEY', d: 'Free key from newsapi.org' },
  { p: 'NewsAPI', u: 'https://newsapi.org/v2', r: '100 req/day (free)', docs: 'https://newsapi.org/docs' },
  ['news', 'articles', 'media', 'headlines'],
  [
    M('search_articles', 'Search Articles', 2, 'Search news articles by keyword', [{s:'q'}, {os:'language'}], '/everything?q=${q}&language=${language}&pageSize=10', {l:'articles',f:['title','url','source','publishedAt','description'],m:10}),
    M('top_headlines', 'Top Headlines', 2, 'Get top headlines by country or category', [{os:'country'}, {os:'category'}], '/top-headlines?country=${country}&category=${category}&pageSize=10', {l:'articles',f:['title','url','source','publishedAt','description'],m:10}),
    M('get_sources', 'Get Sources', 2, 'List available news sources', [{os:'language'}], '/top-headlines/sources?language=${language}', {l:'sources',f:['id','name','url','category','language'],m:20}),
  ])

// ─── 2. gnews ───────────────────────────────────────────────────────────────

G('gnews', 'GNews', 'Search Google News articles by keyword, topic, or country.', 'https://gnews.io/api/v4',
  { q: 'apikey', e: 'GNEWS_API_KEY', d: 'Free key from gnews.io' },
  { p: 'GNews', u: 'https://gnews.io/api/v4', r: '100 req/day (free)', docs: 'https://gnews.io/docs/v4' },
  ['news', 'google-news', 'articles', 'headlines'],
  [
    M('search_news', 'Search News', 2, 'Search news articles by keyword', [{s:'q'}, {os:'lang'}], '/search?q=${q}&lang=${lang}&max=10', {l:'articles',f:['title','url','publishedAt','description','source'],m:10}),
    M('top_headlines', 'Top Headlines', 2, 'Get top headlines by topic or country', [{os:'topic'}, {os:'country'}], '/top-headlines?topic=${topic}&country=${country}&max=10', {l:'articles',f:['title','url','publishedAt','description','source'],m:10}),
  ])

// ─── 3. mediastack ──────────────────────────────────────────────────────────

G('mediastack', 'Mediastack', 'Real-time and historical news articles from 7,500+ sources.', 'https://api.mediastack.com/v1',
  { q: 'access_key', e: 'MEDIASTACK_KEY', d: 'Free key from mediastack.com' },
  { p: 'Mediastack', u: 'https://api.mediastack.com/v1', r: '500 req/month (free)', docs: 'https://mediastack.com/documentation' },
  ['news', 'articles', 'media', 'mediastack'],
  [
    M('search_news', 'Search News', 2, 'Search news articles by keyword', [{s:'keywords'}, {os:'languages'}], '/news?keywords=${keywords}&languages=${languages}&limit=10', {l:'data',f:['title','url','source','published_at','description'],m:10}),
    M('get_sources', 'Get Sources', 2, 'List available news sources', [{os:'countries'}], '/sources?countries=${countries}&limit=20', {l:'data',f:['name','url','country','language','category'],m:20}),
  ])

// ─── 4. worldnewsapi ───────────────────────────────────────────────────────

G('worldnewsapi', 'World News API', 'Search world news articles by keyword, language, or country.', 'https://api.worldnewsapi.com',
  { q: 'api-key', e: 'WORLDNEWS_API_KEY', d: 'Free key from worldnewsapi.com' },
  { p: 'World News API', u: 'https://api.worldnewsapi.com', r: '50 req/day (free)', docs: 'https://worldnewsapi.com/docs/' },
  ['news', 'world-news', 'articles', 'global'],
  [
    M('search_news', 'Search News', 2, 'Search news articles by keyword', [{s:'text'}, {os:'language'}], '/search-news?text=${text}&language=${language}&number=10', {l:'news',f:['title','url','publish_date','text','source_country'],m:10}),
    M('get_top_news', 'Top News', 2, 'Get top news by country', [{s:'source_country'}], '/top-news?source-country=${source_country}&language=en', {l:'top_news',f:['title','url','publish_date','text'],m:10}),
  ])

// ─── 5. currents ────────────────────────────────────────────────────────────

G('currents', 'Currents API', 'Latest news and current events from around the world.', 'https://api.currentsapi.services/v1',
  { q: 'apiKey', e: 'CURRENTS_API_KEY', d: 'Free key from currentsapi.services' },
  { p: 'Currents API', u: 'https://api.currentsapi.services/v1', r: '600 req/day (free)', docs: 'https://currentsapi.services/en/docs/' },
  ['news', 'current-events', 'articles'],
  [
    M('search_news', 'Search News', 2, 'Search current news by keyword', [{s:'keywords'}, {os:'language'}], '/search?keywords=${keywords}&language=${language}', {l:'news',f:['title','url','published','description','category'],m:10}),
    M('latest_news', 'Latest News', 2, 'Get latest news articles', [{os:'language'}], '/latest-news?language=${language}', {l:'news',f:['title','url','published','description','category'],m:10}),
  ])

// ─── 6. newsdata ────────────────────────────────────────────────────────────

G('newsdata', 'Newsdata.io', 'News articles by country, category, and language.', 'https://newsdata.io/api/1',
  { q: 'apikey', e: 'NEWSDATA_API_KEY', d: 'Free key from newsdata.io' },
  { p: 'Newsdata.io', u: 'https://newsdata.io/api/1', r: '200 req/day (free)', docs: 'https://newsdata.io/documentation' },
  ['news', 'articles', 'newsdata', 'country'],
  [
    M('search_news', 'Search News', 2, 'Search news by keyword and country', [{s:'q'}, {os:'country'}], '/news?q=${q}&country=${country}', {l:'results',f:['title','link','pubDate','description','source_id'],m:10}),
    M('latest_news', 'Latest News', 2, 'Get latest news by country', [{os:'country'}, {os:'category'}], '/news?country=${country}&category=${category}', {l:'results',f:['title','link','pubDate','description','source_id'],m:10}),
  ])

// ─── 7. guardian ────────────────────────────────────────────────────────────

G('guardian', 'The Guardian', 'Search articles from The Guardian newspaper.', 'https://content.guardianapis.com',
  { q: 'api-key', e: 'GUARDIAN_API_KEY', d: 'Free key from open-platform.theguardian.com' },
  { p: 'The Guardian', u: 'https://content.guardianapis.com', r: '12 req/s, 5000/day (free)', docs: 'https://open-platform.theguardian.com/documentation/' },
  ['news', 'guardian', 'uk-news', 'articles'],
  [
    M('search_articles', 'Search Articles', 2, 'Search Guardian articles by keyword', [{s:'q'}, {os:'section'}], '/search?q=${q}&section=${section}&page-size=10', {l:'response.results',f:['webTitle','webUrl','sectionName','webPublicationDate','type'],m:10}),
    M('get_article', 'Get Article', 2, 'Get a Guardian article by ID path', [{s:'id'}], '/${id}?show-fields=body,headline,thumbnail', {f:['response']}),
    M('list_sections', 'List Sections', 2, 'List available Guardian sections', [], '/sections', {l:'response.results',f:['id','webTitle','webUrl'],m:30}),
  ])

// ─── 8. nyt ─────────────────────────────────────────────────────────────────

G('nyt', 'New York Times', 'Search NYT articles, top stories, and book reviews.', 'https://api.nytimes.com/svc',
  { q: 'api-key', e: 'NYT_API_KEY', d: 'Free key from developer.nytimes.com' },
  { p: 'The New York Times', u: 'https://api.nytimes.com/svc', r: '10 req/min (free)', docs: 'https://developer.nytimes.com/apis' },
  ['news', 'nyt', 'new-york-times', 'articles'],
  [
    M('search_articles', 'Search Articles', 2, 'Search NYT articles by keyword', [{s:'q'}], '/search/v2/articlesearch.json?q=${q}', {l:'response.docs',f:['headline','web_url','pub_date','abstract','section_name'],m:10}),
    M('top_stories', 'Top Stories', 2, 'Get top stories by section', [{s:'section'}], '/topstories/v2/${section}.json', {l:'results',f:['title','url','published_date','abstract','section'],m:10}),
  ])

// ─── 9. bbc-news ────────────────────────────────────────────────────────────

G('bbc-news', 'BBC News', 'Latest BBC News headlines parsed from RSS feed.', 'https://feeds.bbci.co.uk/news',
  {},
  { p: 'BBC', u: 'https://feeds.bbci.co.uk/news/rss.xml', r: 'Public RSS feed', docs: 'https://www.bbc.co.uk/news/10628494' },
  ['news', 'bbc', 'headlines', 'rss', 'uk'],
  [
    M('get_headlines', 'Get Headlines', 1, 'Get latest BBC News headlines', [], '/rss.xml', {f:['items']}),
    M('get_section', 'Get Section', 1, 'Get BBC News headlines by section (world, business, technology, etc.)', [{s:'section'}], '/${section}/rss.xml', {f:['items']}),
  ])

// ─── 10. podcast-index ──────────────────────────────────────────────────────

G('podcast-index', 'Podcast Index', 'Search podcasts and episodes via the Podcast Index API.', 'https://api.podcastindex.org/api/1.0',
  { h: 'X-Auth-Key', e: 'PODCAST_INDEX_KEY', d: 'API key from podcastindex.org' },
  { p: 'Podcast Index', u: 'https://api.podcastindex.org/api/1.0', r: '300 req/min', docs: 'https://podcastindex-org.github.io/docs-api/' },
  ['podcasts', 'audio', 'media', 'podcast-index'],
  [
    M('search_podcasts', 'Search Podcasts', 2, 'Search podcasts by keyword', [{s:'q'}], '/search/byterm?q=${q}', {l:'feeds',f:['id','title','url','description','author'],m:10}),
    M('get_podcast', 'Get Podcast', 2, 'Get podcast details by feed ID', [{n:'id'}], '/podcasts/byfeedid?id=${id}', {f:['feed']}),
    M('get_episodes', 'Get Episodes', 2, 'Get recent episodes of a podcast', [{n:'id'}], '/episodes/byfeedid?id=${id}&max=10', {l:'items',f:['id','title','datePublished','description','enclosureUrl'],m:10}),
  ])

// ─── 11. listennotes ────────────────────────────────────────────────────────

G('listennotes', 'Listen Notes', 'Search podcasts and episodes via the Listen Notes API.', 'https://listen-api.listennotes.com/api/v2',
  { h: 'X-ListenAPI-Key', e: 'LISTENNOTES_API_KEY', d: 'API key from listennotes.com' },
  { p: 'Listen Notes', u: 'https://listen-api.listennotes.com/api/v2', r: '5 req/s (free)', docs: 'https://www.listennotes.com/api/docs/' },
  ['podcasts', 'audio', 'media', 'listen-notes'],
  [
    M('search_podcasts', 'Search Podcasts', 2, 'Search podcasts by keyword', [{s:'q'}], '/search?q=${q}&type=podcast', {l:'results',f:['id','title_original','publisher_original','description_original','listennotes_url'],m:10}),
    M('search_episodes', 'Search Episodes', 2, 'Search episodes by keyword', [{s:'q'}], '/search?q=${q}&type=episode', {l:'results',f:['id','title_original','podcast_title_original','description_original','listennotes_url'],m:10}),
    M('get_podcast', 'Get Podcast', 2, 'Get podcast details by ID', [{s:'id'}], '/podcasts/${id}', {f:['id','title','publisher','description','listennotes_url','total_episodes']}),
  ])

// ─── 12. reddit-news ────────────────────────────────────────────────────────

G('reddit-news', 'Reddit News', 'Get top news posts from Reddit r/news and r/worldnews.', 'https://www.reddit.com',
  {},
  { p: 'Reddit', u: 'https://www.reddit.com', r: 'Public JSON API', docs: 'https://www.reddit.com/dev/api/' },
  ['news', 'reddit', 'social', 'community'],
  [
    M('get_news', 'Get News', 1, 'Get top posts from r/news', [{os:'sort'}], '/r/news/${sort}.json?limit=15', {l:'data.children',f:['data'],m:15}),
    M('get_worldnews', 'Get World News', 1, 'Get top posts from r/worldnews', [{os:'sort'}], '/r/worldnews/${sort}.json?limit=15', {l:'data.children',f:['data'],m:15}),
    M('search_subreddit', 'Search Subreddit', 1, 'Search posts in a subreddit', [{s:'subreddit'}, {s:'q'}], '/r/${subreddit}/search.json?q=${q}&restrict_sr=1&limit=10', {l:'data.children',f:['data'],m:10}),
  ])

// ─── 13. rss-parser ─────────────────────────────────────────────────────────

G('rss-parser', 'RSS Parser', 'Fetch and parse any RSS/Atom feed into structured data.', 'https://rss.example.com',
  {},
  { p: 'Local XML Parser', u: '', r: 'N/A (local parsing)', docs: '' },
  ['rss', 'atom', 'feed', 'xml', 'parser'],
  [
    M('parse_feed', 'Parse Feed', 1, 'Fetch and parse an RSS/Atom feed URL', [{s:'url'}], '/__local__/parse_feed', {f:['title','items']}),
    M('get_headlines', 'Get Headlines', 1, 'Get headlines from an RSS feed URL', [{s:'url'}, {on:'limit'}], '/__local__/get_headlines', {f:['headlines']}),
  ])

// ─── 14. eventbrite ─────────────────────────────────────────────────────────

G('eventbrite', 'Eventbrite', 'Search and discover events via the Eventbrite API.', 'https://www.eventbriteapi.com/v3',
  { b: true, e: 'EVENTBRITE_TOKEN', d: 'OAuth token from eventbrite.com/platform' },
  { p: 'Eventbrite', u: 'https://www.eventbriteapi.com/v3', r: '2000 req/hr', docs: 'https://www.eventbrite.com/platform/api' },
  ['events', 'eventbrite', 'tickets', 'meetups'],
  [
    M('search_events', 'Search Events', 2, 'Search events by keyword and location', [{s:'q'}, {os:'location'}], '/events/search/?q=${q}&location.address=${location}', {l:'events',f:['id','name','url','start','venue_id','description'],m:10}),
    M('get_event', 'Get Event', 2, 'Get event details by ID', [{s:'id'}], '/events/${id}/', {f:['id','name','url','start','end','description','venue_id','category_id']}),
  ])

// ─── 15. meetup ─────────────────────────────────────────────────────────────

G('meetup', 'Meetup', 'Find upcoming Meetup events by topic and location.', 'https://api.meetup.com',
  { b: true, e: 'MEETUP_TOKEN', d: 'OAuth token from meetup.com/api' },
  { p: 'Meetup', u: 'https://api.meetup.com', r: '200 req/hr', docs: 'https://www.meetup.com/api/schema/' },
  ['events', 'meetup', 'community', 'groups'],
  [
    M('find_events', 'Find Events', 2, 'Find upcoming events by topic', [{s:'query'}, {os:'lat'}, {os:'lon'}], '/find/upcoming_events?text=${query}&lat=${lat}&lon=${lon}', {l:'events',f:['id','name','link','local_date','local_time','group'],m:10}),
    M('get_group', 'Get Group', 2, 'Get Meetup group details by URL name', [{s:'urlname'}], '/${urlname}', {f:['id','name','link','members','city','description']}),
  ])

console.log('\n=== Utilities/Misc (15 servers) ===\n')

// ─── 16. ipify ──────────────────────────────────────────────────────────────

G('ipify', 'ipify', 'Get your public IPv4 and IPv6 addresses.', 'https://api.ipify.org',
  {},
  { p: 'ipify', u: 'https://api.ipify.org', r: 'Unlimited', docs: 'https://www.ipify.org/' },
  ['ip', 'network', 'ipv4', 'ipv6', 'utility'],
  [
    M('get_ipv4', 'Get IPv4', 1, 'Get your public IPv4 address', [], '/?format=json', {f:['ip']}),
    M('get_ipv6', 'Get IPv6', 1, 'Get your public IPv6 address', [], '/__ipv6__', {f:['ip']}),
  ])

// ─── 17. user-agent ─────────────────────────────────────────────────────────

G('user-agent', 'User Agent Parser', 'Parse user agent strings into browser, OS, and device info.', 'https://local.settlegrid.ai',
  {},
  { p: 'Local Parser', u: '', r: 'N/A (local)', docs: '' },
  ['user-agent', 'browser', 'parser', 'utility'],
  [
    M('parse_ua', 'Parse User Agent', 1, 'Parse a user agent string into components', [{s:'ua'}], '/__local__/parse_ua', {f:['browser','os','device']}),
    M('detect_bot', 'Detect Bot', 1, 'Check if a user agent is a known bot', [{s:'ua'}], '/__local__/detect_bot', {f:['isBot','botName']}),
  ])

// ─── 18. password-gen ───────────────────────────────────────────────────────

G('password-gen', 'Password Generator', 'Generate cryptographically secure passwords and passphrases.', 'https://local.settlegrid.ai',
  {},
  { p: 'Local (crypto)', u: '', r: 'N/A (local)', docs: '' },
  ['password', 'security', 'generator', 'crypto'],
  [
    M('generate', 'Generate Password', 1, 'Generate a secure random password', [{on:'length'}, {os:'options'}], '/__local__/generate', {f:['password','strength']}),
    M('generate_passphrase', 'Generate Passphrase', 1, 'Generate a random word passphrase', [{on:'words'}], '/__local__/generate_passphrase', {f:['passphrase','wordCount']}),
  ])

// ─── 19. uuid-gen ───────────────────────────────────────────────────────────

G('uuid-gen', 'UUID Generator', 'Generate UUIDs (v4) singly or in bulk.', 'https://local.settlegrid.ai',
  {},
  { p: 'Local (crypto)', u: '', r: 'N/A (local)', docs: '' },
  ['uuid', 'generator', 'utility', 'crypto'],
  [
    M('generate_v4', 'Generate UUID v4', 1, 'Generate a single UUID v4', [], '/__local__/generate_v4', {f:['uuid']}),
    M('generate_bulk', 'Generate Bulk', 1, 'Generate multiple UUIDs', [{on:'count'}], '/__local__/generate_bulk', {f:['uuids','count']}),
  ])

// ─── 20. hash ───────────────────────────────────────────────────────────────

G('hash', 'Hash Generator', 'Hash text with SHA-256, SHA-512, MD5, and more.', 'https://local.settlegrid.ai',
  {},
  { p: 'Local (crypto)', u: '', r: 'N/A (local)', docs: '' },
  ['hash', 'sha256', 'md5', 'crypto', 'utility'],
  [
    M('hash_text', 'Hash Text', 1, 'Hash text with a specified algorithm', [{s:'text'}, {os:'algorithm'}], '/__local__/hash_text', {f:['hash','algorithm']}),
    M('hash_compare', 'Compare Hash', 1, 'Check if text matches a hash', [{s:'text'}, {s:'hash'}, {os:'algorithm'}], '/__local__/hash_compare', {f:['match','algorithm']}),
  ])

// ─── 21. base64 ─────────────────────────────────────────────────────────────

G('base64', 'Base64', 'Encode and decode Base64 strings.', 'https://local.settlegrid.ai',
  {},
  { p: 'Local (Buffer)', u: '', r: 'N/A (local)', docs: '' },
  ['base64', 'encoding', 'utility'],
  [
    M('encode', 'Encode', 1, 'Encode text to Base64', [{s:'text'}], '/__local__/encode', {f:['encoded']}),
    M('decode', 'Decode', 1, 'Decode Base64 to text', [{s:'encoded'}], '/__local__/decode', {f:['decoded']}),
  ])

// ─── 22. markdown ───────────────────────────────────────────────────────────

G('markdown', 'Markdown Renderer', 'Convert Markdown to HTML via the GitHub Markdown API.', 'https://api.github.com',
  {},
  { p: 'GitHub', u: 'https://api.github.com/markdown', r: '60 req/hr (unauth)', docs: 'https://docs.github.com/en/rest/markdown' },
  ['markdown', 'html', 'converter', 'github'],
  [
    M('render', 'Render Markdown', 1, 'Render Markdown text to HTML', [{s:'text'}], '/markdown', {f:['html']}),
    M('render_raw', 'Render Raw', 1, 'Render raw Markdown to HTML', [{s:'text'}], '/markdown/raw', {f:['html']}),
  ])

// ─── 23. color ──────────────────────────────────────────────────────────────

G('color', 'Color Converter', 'Convert colors between hex, RGB, and HSL formats.', 'https://local.settlegrid.ai',
  {},
  { p: 'Local', u: '', r: 'N/A (local)', docs: '' },
  ['color', 'converter', 'hex', 'rgb', 'hsl', 'utility'],
  [
    M('convert', 'Convert Color', 1, 'Convert a color between hex, RGB, and HSL', [{s:'color'}, {os:'format'}], '/__local__/convert', {f:['hex','rgb','hsl']}),
    M('random_color', 'Random Color', 1, 'Generate a random color', [], '/__local__/random_color', {f:['hex','rgb','hsl']}),
  ])

// ─── 24. placeholder ────────────────────────────────────────────────────────

G('placeholder', 'Placeholder Images', 'Generate placeholder images via placehold.co.', 'https://placehold.co',
  {},
  { p: 'placehold.co', u: 'https://placehold.co', r: 'Unlimited', docs: 'https://placehold.co/' },
  ['placeholder', 'images', 'design', 'utility'],
  [
    M('get_image', 'Get Image', 1, 'Get a placeholder image URL', [{n:'width'}, {n:'height'}, {os:'text'}, {os:'bg'}, {os:'color'}], '/${width}x${height}/${bg}/${color}?text=${text}', {f:['url','width','height']}),
    M('get_svg', 'Get SVG', 1, 'Get a placeholder SVG URL', [{n:'width'}, {n:'height'}, {os:'text'}], '/${width}x${height}.svg?text=${text}', {f:['url','width','height']}),
  ])

// ─── 25. avatar ─────────────────────────────────────────────────────────────

G('avatar', 'DiceBear Avatars', 'Generate avatar images via the DiceBear API.', 'https://api.dicebear.com/7.x',
  {},
  { p: 'DiceBear', u: 'https://api.dicebear.com/7.x', r: 'Unlimited', docs: 'https://www.dicebear.com/how-to-use/http-api/' },
  ['avatar', 'images', 'profile', 'design'],
  [
    M('generate', 'Generate Avatar', 1, 'Generate an avatar by seed and style', [{s:'seed'}, {os:'style'}], '/${style}/svg?seed=${seed}', {f:['url','seed','style']}),
    M('get_styles', 'Get Styles', 1, 'List available avatar styles', [], '/__local__/get_styles', {f:['styles']}),
  ])

// ─── 26. barcode-gen ────────────────────────────────────────────────────────

G('barcode-gen', 'Barcode Generator', 'Generate barcodes and QR codes via barcodeapi.org.', 'https://barcodeapi.org/api',
  {},
  { p: 'barcodeapi.org', u: 'https://barcodeapi.org/api', r: 'Unlimited', docs: 'https://barcodeapi.org/' },
  ['barcode', 'qr-code', 'generator', 'utility'],
  [
    M('generate', 'Generate Barcode', 1, 'Generate a barcode image URL', [{s:'data'}, {os:'type'}], '/${type}/${data}', {f:['url','type','data']}),
    M('generate_qr', 'Generate QR', 1, 'Generate a QR code image URL', [{s:'data'}], '/qr/${data}', {f:['url','data']}),
  ])

// ─── 27. pdf-gen ────────────────────────────────────────────────────────────

G('pdf-gen', 'PDF Generator', 'Generate PDFs from HTML or URLs via html2pdf.app.', 'https://api.html2pdf.app/v1/generate',
  {},
  { p: 'html2pdf.app', u: 'https://api.html2pdf.app/v1/generate', r: '100 req/day (free)', docs: 'https://html2pdf.app/documentation/' },
  ['pdf', 'generator', 'html', 'converter'],
  [
    M('from_url', 'From URL', 1, 'Generate PDF from a URL', [{s:'url'}], '?url=${url}&apiKey=free', {f:['pdfUrl']}),
    M('from_html', 'From HTML', 1, 'Generate PDF from HTML string', [{s:'html'}], '?html=${html}&apiKey=free', {f:['pdfUrl']}),
  ])

// ─── 28. email-validate ─────────────────────────────────────────────────────

G('email-validate', 'Email Validator', 'Validate email addresses via Abstract API.', 'https://emailvalidation.abstractapi.com/v1',
  { q: 'api_key', e: 'ABSTRACT_EMAIL_KEY', d: 'Free key from abstractapi.com' },
  { p: 'Abstract API', u: 'https://emailvalidation.abstractapi.com/v1', r: '100 req/day (free)', docs: 'https://docs.abstractapi.com/email-validation' },
  ['email', 'validation', 'utility'],
  [
    M('validate', 'Validate Email', 2, 'Validate an email address', [{s:'email'}], '/?email=${email}', {f:['email','deliverability','is_valid_format','is_disposable_email','is_free_email']}),
  ])

// ─── 29. phone-validate ─────────────────────────────────────────────────────

G('phone-validate', 'Phone Validator', 'Validate and lookup phone numbers via Abstract API.', 'https://phonevalidation.abstractapi.com/v1',
  { q: 'api_key', e: 'ABSTRACT_PHONE_KEY', d: 'Free key from abstractapi.com' },
  { p: 'Abstract API', u: 'https://phonevalidation.abstractapi.com/v1', r: '100 req/day (free)', docs: 'https://docs.abstractapi.com/phone-validation' },
  ['phone', 'validation', 'utility'],
  [
    M('validate', 'Validate Phone', 2, 'Validate a phone number', [{s:'phone'}], '/?phone=${phone}', {f:['phone','valid','country','carrier','type','location']}),
  ])

// ─── 30. domain-check ───────────────────────────────────────────────────────

G('domain-check', 'Domain Checker', 'Check domain name availability via WhoisXML API.', 'https://domain-availability.whoisxmlapi.com/api/v1',
  { q: 'apiKey', e: 'WHOISXML_API_KEY', d: 'Free key from whoisxmlapi.com' },
  { p: 'WhoisXML API', u: 'https://domain-availability.whoisxmlapi.com/api/v1', r: '500 req/month (free)', docs: 'https://domain-availability.whoisxmlapi.com/api/documentation' },
  ['domain', 'whois', 'availability', 'dns'],
  [
    M('check', 'Check Domain', 2, 'Check if a domain name is available', [{s:'domain'}], '?domainName=${domain}&outputFormat=JSON', {f:['DomainInfo']}),
    M('check_bulk', 'Check Bulk', 2, 'Check multiple domains (comma-separated)', [{s:'domains'}], '?domainName=${domains}&outputFormat=JSON', {f:['DomainInfo']}),
  ])

console.log('\nDone! 30 servers generated.\n')
