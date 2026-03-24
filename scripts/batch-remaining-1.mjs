/**
 * batch-remaining-1.mjs
 *
 * Generates 32 SettleGrid MCP servers (16 new, 16 already exist and will be regenerated):
 *
 *   Weather  (3):  breezometer, pollen-api, climate-data
 *   DevTools (13): github-api, gitlab-api, mdn-search, random-user, qr-code, url-shortener,
 *                  whois, ssl-labs, security-headers, pagespeed, wayback-machine, carbon-sh, codepoint
 *   AI/ML    (6):  whisper-api, dalle, ocr-space, remove-bg, wolfram-alpha, huggingface-datasets
 *   Gov     (10):  data-gov, usa-spending, fec-elections, congress-api, usps-lookup,
 *                  uk-companies, canada-open, japan-estat, south-korea, un-data
 */

import { G, M } from './lib/generate-auto.mjs'

console.log('Generating 32 SettleGrid MCP servers...\n')
console.log('── Weather (3) ──')

// ═══════════════════════════════════════════════════════════════════════════════
// Weather — breezometer
// ═══════════════════════════════════════════════════════════════════════════════
G('breezometer', 'BreezoMeter Air Quality', 'Real-time air quality index, pollutants, and pollen data by location.', 'https://api.breezometer.com',
  { q: 'key', e: 'BREEZOMETER_API_KEY', d: 'Free key from breezometer.com/products/air-quality-api' },
  { p: 'BreezoMeter', u: 'https://api.breezometer.com', r: '1000 calls/day (free)', docs: 'https://docs.breezometer.com/api-documentation/air-quality-api/v2/' },
  ['air-quality', 'pollution', 'pollen', 'weather', 'health'],
  [
    M('get_air_quality', 'Air Quality', 2, 'Get current air quality index and pollutants for a location',
      [{ n: 'lat' }, { n: 'lng' }],
      '/air-quality/v2/current-conditions?lat=${lat}&lon=${lng}&features=breezometer_aqi,pollutants',
      { f: ['breezometer_aqi', 'datetime', 'data_available'] }),
    M('get_pollen', 'Pollen Forecast', 2, 'Get pollen count and forecast for a location',
      [{ n: 'lat' }, { n: 'lng' }],
      '/pollen/v2/forecast/daily?lat=${lat}&lon=${lng}&days=3',
      { l: 'data', f: ['date', 'types', 'plants_index'], m: 3 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Weather — pollen-api
// ═══════════════════════════════════════════════════════════════════════════════
G('pollen-api', 'Ambee Pollen & Allergy', 'Pollen counts, allergy risk, and air quality via Ambee.', 'https://api.ambeedata.com',
  { h: 'x-api-key', e: 'AMBEE_API_KEY', d: 'Free key from api-dashboard.getambee.com' },
  { p: 'Ambee', u: 'https://api.ambeedata.com', r: '100 calls/day (free)', docs: 'https://docs.ambeedata.com/' },
  ['pollen', 'allergy', 'air-quality', 'health', 'weather'],
  [
    M('get_pollen_data', 'Pollen Data', 2, 'Get real-time pollen count and risk by coordinates',
      [{ n: 'lat' }, { n: 'lng' }],
      '/latest/pollen/by-lat-lng?lat=${lat}&lng=${lng}',
      { l: 'data', f: ['Count', 'Risk', 'Species', 'updatedAt'], m: 10 }),
    M('get_air_quality', 'Air Quality', 2, 'Get current air quality index by coordinates',
      [{ n: 'lat' }, { n: 'lng' }],
      '/latest/by-lat-lng?lat=${lat}&lng=${lng}',
      { l: 'stations', f: ['CO', 'NO2', 'OZONE', 'PM25', 'AQI', 'aqiInfo'], m: 5 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Weather — climate-data
// ═══════════════════════════════════════════════════════════════════════════════
G('climate-data', 'Historical Climate Data', 'Historical weather and climate data from Open-Meteo archive.', 'https://archive-api.open-meteo.com/v1',
  {},
  { p: 'Open-Meteo', u: 'https://archive-api.open-meteo.com', r: '10,000 calls/day (free, no key)', docs: 'https://open-meteo.com/en/docs/historical-weather-api' },
  ['climate', 'historical', 'weather', 'temperature', 'precipitation'],
  [
    M('get_historical_weather', 'Historical Weather', 1, 'Get historical daily weather for a location and date range',
      [{ n: 'lat' }, { n: 'lng' }, { s: 'start_date' }, { s: 'end_date' }],
      '/archive?latitude=${lat}&longitude=${lng}&start_date=${start_date}&end_date=${end_date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum',
      { f: ['latitude', 'longitude', 'daily', 'daily_units'] }),
    M('get_climate_normals', 'Climate Normals', 1, 'Get climate normals (monthly averages) for a location',
      [{ n: 'lat' }, { n: 'lng' }],
      '/archive?latitude=${lat}&longitude=${lng}&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_max,temperature_2m_min&timezone=auto',
      { f: ['latitude', 'longitude', 'daily', 'daily_units'] }),
  ])

console.log('\n── DevTools (13) ──')

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — github-api
// ═══════════════════════════════════════════════════════════════════════════════
G('github-api', 'GitHub', 'Search repos, issues, and users on GitHub.', 'https://api.github.com',
  { b: true, e: 'GITHUB_TOKEN', d: 'Personal access token from github.com/settings/tokens' },
  { p: 'GitHub', u: 'https://api.github.com', r: '5000 req/hr (authenticated)', docs: 'https://docs.github.com/en/rest' },
  ['github', 'git', 'repos', 'issues', 'developer'],
  [
    M('search_repos', 'Search Repos', 2, 'Search GitHub repositories by query',
      [{ s: 'query' }, { on: 'per_page' }],
      '/search/repositories?q=${query}&per_page=${per_page}',
      { l: 'items', f: ['full_name', 'description', 'stargazers_count', 'language', 'html_url'], m: 10 }),
    M('get_repo', 'Get Repo', 2, 'Get details about a specific repository',
      [{ s: 'owner' }, { s: 'repo' }],
      '/repos/${owner}/${repo}',
      { f: ['full_name', 'description', 'stargazers_count', 'forks_count', 'language', 'open_issues_count', 'html_url'] }),
    M('search_issues', 'Search Issues', 2, 'Search issues and pull requests across GitHub',
      [{ s: 'query' }, { on: 'per_page' }],
      '/search/issues?q=${query}&per_page=${per_page}',
      { l: 'items', f: ['title', 'state', 'html_url', 'user', 'created_at'], m: 10 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — gitlab-api
// ═══════════════════════════════════════════════════════════════════════════════
G('gitlab-api', 'GitLab', 'Search projects, merge requests, and pipelines on GitLab.', 'https://gitlab.com/api/v4',
  { h: 'PRIVATE-TOKEN', e: 'GITLAB_TOKEN', d: 'Personal access token from gitlab.com/-/user_settings/personal_access_tokens' },
  { p: 'GitLab', u: 'https://gitlab.com/api/v4', r: '2000 req/hr (authenticated)', docs: 'https://docs.gitlab.com/ee/api/rest/' },
  ['gitlab', 'git', 'projects', 'merge-requests', 'ci-cd'],
  [
    M('search_projects', 'Search Projects', 2, 'Search GitLab projects by name or keyword',
      [{ s: 'query' }],
      '/projects?search=${query}&order_by=stars_count&per_page=10',
      { f: ['id', 'name', 'description', 'star_count', 'web_url'], m: 10 }),
    M('get_project', 'Get Project', 2, 'Get details of a specific GitLab project by ID',
      [{ n: 'id' }],
      '/projects/${id}',
      { f: ['id', 'name', 'description', 'star_count', 'forks_count', 'web_url', 'default_branch'] }),
    M('list_pipelines', 'List Pipelines', 2, 'List recent CI/CD pipelines for a project',
      [{ n: 'project_id' }],
      '/projects/${project_id}/pipelines?per_page=10',
      { f: ['id', 'status', 'ref', 'created_at', 'web_url'], m: 10 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — mdn-search
// ═══════════════════════════════════════════════════════════════════════════════
G('mdn-search', 'MDN Web Docs', 'Search Mozilla Developer Network web documentation.', 'https://developer.mozilla.org/api/v1',
  {},
  { p: 'Mozilla', u: 'https://developer.mozilla.org', r: 'No published rate limit (be respectful)', docs: 'https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines' },
  ['mdn', 'web', 'docs', 'html', 'css', 'javascript', 'developer'],
  [
    M('search_docs', 'Search Docs', 1, 'Search MDN web documentation articles',
      [{ s: 'query' }],
      '/search?q=${query}&locale=en-US',
      { l: 'documents', f: ['title', 'slug', 'summary', 'mdn_url'], m: 10 }),
    M('get_document', 'Get Document', 1, 'Get a specific MDN document by slug',
      [{ s: 'slug' }],
      '/doc/en-US/${slug}',
      { f: ['title', 'summary', 'mdn_url', 'modified'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — random-user
// ═══════════════════════════════════════════════════════════════════════════════
G('random-user', 'Random User Generator', 'Generate random user profiles for testing and development.', 'https://randomuser.me/api',
  {},
  { p: 'RandomUser.me', u: 'https://randomuser.me', r: 'Unlimited (no key)', docs: 'https://randomuser.me/documentation' },
  ['random', 'user', 'fake', 'testing', 'mock-data'],
  [
    M('generate_users', 'Generate Users', 1, 'Generate random user profiles',
      [{ on: 'count' }, { os: 'nationality' }],
      '/?results=${count}&nat=${nationality}&noinfo',
      { l: 'results', f: ['name', 'email', 'location', 'phone', 'picture'], m: 20 }),
    M('generate_user', 'Generate User', 1, 'Generate a single random user with full details',
      [{ os: 'nationality' }],
      '/?results=1&nat=${nationality}&noinfo',
      { l: 'results', f: ['name', 'email', 'location', 'phone', 'login', 'dob', 'picture'], m: 1 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — qr-code
// ═══════════════════════════════════════════════════════════════════════════════
G('qr-code', 'QR Code Generator', 'Generate QR codes from text or URLs.', 'https://api.qrserver.com/v1',
  {},
  { p: 'goQR.me', u: 'https://goqr.me/api/', r: 'Unlimited (no key)', docs: 'https://goqr.me/api/doc/create-qr-code/' },
  ['qr', 'qrcode', 'barcode', 'generator', 'url'],
  [
    M('create_qr', 'Create QR Code', 1, 'Generate a QR code image URL for given data',
      [{ s: 'data' }, { on: 'size' }],
      '/create-qr-code/?data=${data}&size=${size}x${size}&format=png',
      { f: ['url'] }),
    M('read_qr', 'Read QR Code', 1, 'Read/decode a QR code from an image URL',
      [{ s: 'image_url' }],
      '/read-qr-code/?fileurl=${image_url}',
      { l: 'data', f: ['type', 'symbol'], m: 1 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — url-shortener
// ═══════════════════════════════════════════════════════════════════════════════
G('url-shortener', 'URL Shortener', 'Shorten long URLs using the is.gd service.', 'https://is.gd',
  {},
  { p: 'is.gd', u: 'https://is.gd', r: 'Reasonable use (no key)', docs: 'https://is.gd/developers.php' },
  ['url', 'shortener', 'link', 'shorten'],
  [
    M('shorten_url', 'Shorten URL', 1, 'Create a shortened URL',
      [{ s: 'url' }],
      '/create.php?format=json&url=${url}',
      { f: ['shorturl'] }),
    M('shorten_custom', 'Shorten with Custom Alias', 1, 'Create a shortened URL with custom shorturl path (via v.gd)',
      [{ s: 'url' }, { s: 'shorturl' }],
      '/create.php?format=json&url=${url}&shorturl=${shorturl}',
      { f: ['shorturl'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — whois
// ═══════════════════════════════════════════════════════════════════════════════
G('whois', 'WHOIS Domain Lookup', 'Domain WHOIS registration and availability lookup.', 'https://whoisjs.com/api/v1',
  {},
  { p: 'WhoisJS', u: 'https://whoisjs.com', r: 'Fair use (no key)', docs: 'https://whoisjs.com' },
  ['whois', 'domain', 'dns', 'registration', 'lookup'],
  [
    M('lookup_domain', 'Domain Lookup', 1, 'Get WHOIS info for a domain name',
      [{ s: 'domain' }],
      '/${domain}',
      { f: ['name', 'registrar', 'creation_date', 'expiration_date', 'name_servers', 'status'] }),
    M('check_availability', 'Check Availability', 1, 'Check if a domain is available for registration',
      [{ s: 'domain' }],
      '/${domain}',
      { f: ['name', 'registrar', 'status'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — ssl-labs
// ═══════════════════════════════════════════════════════════════════════════════
G('ssl-labs', 'SSL Labs', 'SSL/TLS certificate testing and grading via Qualys SSL Labs.', 'https://api.ssllabs.com/api/v3',
  {},
  { p: 'Qualys SSL Labs', u: 'https://www.ssllabs.com', r: '25 concurrent assessments', docs: 'https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md' },
  ['ssl', 'tls', 'security', 'certificate', 'https'],
  [
    M('analyze_host', 'Analyze Host', 1, 'Start or retrieve SSL/TLS analysis for a host',
      [{ s: 'host' }],
      '/analyze?host=${host}&all=done',
      { f: ['host', 'port', 'protocol', 'status', 'startTime', 'testTime', 'endpoints'] }),
    M('get_endpoint', 'Get Endpoint', 1, 'Get detailed endpoint results from an analysis',
      [{ s: 'host' }, { s: 'ip' }],
      '/getEndpointData?host=${host}&s=${ip}',
      { f: ['ipAddress', 'grade', 'gradeTrustIgnored', 'hasWarnings', 'details'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — security-headers
// ═══════════════════════════════════════════════════════════════════════════════
G('security-headers', 'Security Headers', 'Analyze HTTP security headers of any website.', 'https://securityheaders.com',
  {},
  { p: 'SecurityHeaders.com', u: 'https://securityheaders.com', r: 'Fair use (no key)', docs: 'https://securityheaders.com' },
  ['security', 'headers', 'http', 'csp', 'hsts'],
  [
    M('scan_headers', 'Scan Headers', 1, 'Analyze security headers of a URL',
      [{ s: 'url' }],
      '/?q=${url}&followRedirects=on&hide=on',
      { f: ['grade', 'headers', 'missing'] }),
    M('check_csp', 'Check CSP', 1, 'Check Content-Security-Policy header of a URL',
      [{ s: 'url' }],
      '/?q=${url}&followRedirects=on&hide=on',
      { f: ['grade', 'headers'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — pagespeed
// ═══════════════════════════════════════════════════════════════════════════════
G('pagespeed', 'Google PageSpeed Insights', 'Website performance analysis via Google PageSpeed Insights.', 'https://www.googleapis.com/pagespeedonline/v5',
  { q: 'key', e: 'GOOGLE_API_KEY', d: 'Free key from console.cloud.google.com/apis' },
  { p: 'Google', u: 'https://developers.google.com/speed/docs/insights/v5/get-started', r: '25,000 queries/day (free)', docs: 'https://developers.google.com/speed/docs/insights/v5/reference' },
  ['pagespeed', 'performance', 'lighthouse', 'seo', 'web-vitals'],
  [
    M('analyze_url', 'Analyze URL', 2, 'Run PageSpeed analysis on a URL (mobile)',
      [{ s: 'url' }],
      '/runPagespeed?url=${url}&strategy=mobile&category=performance&category=accessibility&category=seo',
      { f: ['id', 'lighthouseResult'] }),
    M('analyze_desktop', 'Analyze Desktop', 2, 'Run PageSpeed analysis on a URL (desktop)',
      [{ s: 'url' }],
      '/runPagespeed?url=${url}&strategy=desktop&category=performance&category=accessibility&category=seo',
      { f: ['id', 'lighthouseResult'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — wayback-machine
// ═══════════════════════════════════════════════════════════════════════════════
G('wayback-machine', 'Wayback Machine', 'Check if URLs are archived in the Internet Archive Wayback Machine.', 'https://archive.org',
  {},
  { p: 'Internet Archive', u: 'https://archive.org', r: 'No published limit (be respectful)', docs: 'https://archive.org/help/wayback_api.php' },
  ['archive', 'wayback', 'history', 'web', 'snapshot'],
  [
    M('check_url', 'Check URL', 1, 'Check if a URL has been archived and get the latest snapshot',
      [{ s: 'url' }],
      '/wayback/available?url=${url}',
      { f: ['url', 'archived_snapshots'] }),
    M('get_snapshot', 'Get Snapshot', 1, 'Get a specific archived snapshot by URL and timestamp',
      [{ s: 'url' }, { os: 'timestamp' }],
      '/wayback/available?url=${url}&timestamp=${timestamp}',
      { f: ['url', 'archived_snapshots'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — carbon-sh
// ═══════════════════════════════════════════════════════════════════════════════
G('carbon-sh', 'Carbonara Code Screenshots', 'Generate beautiful code screenshots via Carbonara (Carbon.sh alternative).', 'https://carbonara.solopov.dev',
  {},
  { p: 'Carbonara', u: 'https://carbonara.solopov.dev', r: 'No published limit (open source)', docs: 'https://github.com/petersolopov/carbonara' },
  ['code', 'screenshot', 'carbon', 'image', 'snippet'],
  [
    M('create_screenshot', 'Create Screenshot', 1, 'Generate a code screenshot image (returns PNG URL)',
      [{ s: 'code' }, { os: 'language' }, { os: 'theme' }],
      '/api/cook',
      { f: ['url'] }),
    M('create_styled', 'Create Styled', 1, 'Generate a styled code screenshot with custom background',
      [{ s: 'code' }, { os: 'language' }, { os: 'backgroundColor' }],
      '/api/cook',
      { f: ['url'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// DevTools — codepoint
// ═══════════════════════════════════════════════════════════════════════════════
G('codepoint', 'Unicode Codepoint Lookup', 'Look up Unicode character information and properties.', 'https://www.unicode.org/Public',
  {},
  { p: 'codepoints.net', u: 'https://codepoints.net', r: 'Fair use (no key)', docs: 'https://codepoints.net/about#api' },
  ['unicode', 'codepoint', 'character', 'emoji', 'text'],
  [
    M('lookup_codepoint', 'Lookup Codepoint', 1, 'Get information about a Unicode codepoint (e.g. "U+0041" or hex "0041")',
      [{ s: 'codepoint' }],
      '/codepoint/${codepoint}',
      { f: ['cp', 'name', 'block', 'category', 'script'] }),
    M('search_characters', 'Search Characters', 1, 'Search Unicode characters by name',
      [{ s: 'query' }],
      '/search?q=${query}',
      { l: 'results', f: ['cp', 'name', 'block'], m: 10 }),
  ])

console.log('\n── AI/ML (6) ──')

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — whisper-api
// ═══════════════════════════════════════════════════════════════════════════════
G('whisper-api', 'OpenAI Whisper', 'Audio transcription and translation via the OpenAI Whisper API.', 'https://api.openai.com/v1/audio',
  { b: true, e: 'OPENAI_API_KEY', d: 'API key from platform.openai.com/api-keys' },
  { p: 'OpenAI', u: 'https://api.openai.com', r: 'Tier-based (see OpenAI docs)', docs: 'https://platform.openai.com/docs/api-reference/audio' },
  ['ai', 'transcription', 'audio', 'speech-to-text', 'whisper'],
  [
    M('transcribe_audio', 'Transcribe Audio', 5, 'Transcribe audio file to text via Whisper',
      [{ s: 'url' }, { os: 'language' }],
      '/transcriptions',
      { f: ['text'] }),
    M('translate_audio', 'Translate Audio', 5, 'Translate audio to English text via Whisper',
      [{ s: 'url' }],
      '/translations',
      { f: ['text'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — dalle
// ═══════════════════════════════════════════════════════════════════════════════
G('dalle', 'DALL-E Image Generation', 'Generate images from text prompts via OpenAI DALL-E.', 'https://api.openai.com/v1/images',
  { b: true, e: 'OPENAI_API_KEY', d: 'API key from platform.openai.com/api-keys' },
  { p: 'OpenAI', u: 'https://api.openai.com', r: 'Tier-based (see OpenAI docs)', docs: 'https://platform.openai.com/docs/api-reference/images' },
  ['ai', 'image', 'generation', 'dalle', 'creative'],
  [
    M('generate_image', 'Generate Image', 5, 'Generate an image from a text prompt',
      [{ s: 'prompt' }, { os: 'size' }],
      '/generations',
      { l: 'data', f: ['url', 'revised_prompt'], m: 1 }),
    M('create_variation', 'Create Variation', 5, 'Create a variation of an existing image',
      [{ s: 'image_url' }, { os: 'size' }],
      '/variations',
      { l: 'data', f: ['url'], m: 1 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — ocr-space
// ═══════════════════════════════════════════════════════════════════════════════
G('ocr-space', 'OCR.space', 'Extract text from images and PDFs via OCR.space API.', 'https://api.ocr.space',
  { q: 'apikey', e: 'OCR_SPACE_API_KEY', d: 'Free key from ocr.space/ocrapi' },
  { p: 'OCR.space', u: 'https://ocr.space', r: '25,000 calls/month (free)', docs: 'https://ocr.space/ocrapi' },
  ['ocr', 'text-extraction', 'image', 'pdf', 'ai'],
  [
    M('extract_text', 'Extract Text', 3, 'Extract text from an image URL',
      [{ s: 'url' }, { os: 'language' }],
      '/parse/imageurl?url=${url}&language=${language}&OCREngine=2',
      { l: 'ParsedResults', f: ['ParsedText', 'ErrorMessage', 'FileParseExitCode'], m: 1 }),
    M('extract_from_pdf', 'Extract from PDF', 3, 'Extract text from a PDF URL',
      [{ s: 'url' }],
      '/parse/imageurl?url=${url}&isTable=true&OCREngine=2',
      { l: 'ParsedResults', f: ['ParsedText', 'ErrorMessage', 'FileParseExitCode'], m: 5 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — remove-bg
// ═══════════════════════════════════════════════════════════════════════════════
G('remove-bg', 'Remove.bg', 'Remove image backgrounds automatically via Remove.bg API.', 'https://api.remove.bg/v1.0',
  { h: 'X-Api-Key', e: 'REMOVE_BG_API_KEY', d: 'Free key from remove.bg/api' },
  { p: 'Remove.bg', u: 'https://www.remove.bg', r: '50 calls/month (free)', docs: 'https://www.remove.bg/api' },
  ['image', 'background-removal', 'ai', 'photo', 'editing'],
  [
    M('remove_background', 'Remove Background', 3, 'Remove background from an image URL',
      [{ s: 'image_url' }, { os: 'size' }],
      '/removebg',
      { f: ['result_b64', 'foreground_type'] }),
    M('remove_bg_with_color', 'Remove BG with Color', 3, 'Remove background and replace with a solid color',
      [{ s: 'image_url' }, { os: 'bg_color' }],
      '/removebg',
      { f: ['result_b64', 'foreground_type'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — wolfram-alpha
// ═══════════════════════════════════════════════════════════════════════════════
G('wolfram-alpha', 'Wolfram Alpha', 'Computational knowledge engine — math, science, data.', 'https://api.wolframalpha.com/v1',
  { q: 'appid', e: 'WOLFRAM_APP_ID', d: 'Free AppID from developer.wolframalpha.com' },
  { p: 'Wolfram Alpha', u: 'https://www.wolframalpha.com', r: '2,000 calls/month (free)', docs: 'https://products.wolframalpha.com/api/documentation' },
  ['math', 'computation', 'science', 'knowledge', 'ai'],
  [
    M('query', 'Query', 3, 'Ask Wolfram Alpha a computational question (short answer)',
      [{ s: 'input' }],
      '/result?i=${input}&output=JSON',
      { f: ['queryresult'] }),
    M('full_query', 'Full Query', 3, 'Ask Wolfram Alpha with full structured results',
      [{ s: 'input' }],
      '/result?i=${input}&output=JSON&podstate=Step-by-step+solution',
      { f: ['queryresult'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — huggingface-datasets
// ═══════════════════════════════════════════════════════════════════════════════
G('huggingface-datasets', 'Hugging Face Datasets', 'Search and browse ML datasets on Hugging Face Hub.', 'https://huggingface.co/api',
  {},
  { p: 'Hugging Face', u: 'https://huggingface.co', r: 'No published limit (no key)', docs: 'https://huggingface.co/docs/hub/api' },
  ['ml', 'datasets', 'ai', 'huggingface', 'data'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search Hugging Face datasets by keyword',
      [{ s: 'query' }, { on: 'limit' }],
      '/datasets?search=${query}&limit=${limit}',
      { f: ['id', 'description', 'downloads', 'likes', 'tags'], m: 10 }),
    M('get_dataset', 'Get Dataset', 1, 'Get details about a specific dataset',
      [{ s: 'dataset_id' }],
      '/datasets/${dataset_id}',
      { f: ['id', 'description', 'citation', 'downloads', 'likes', 'tags', 'cardData'] }),
  ])

console.log('\n── Government (10) ──')

// ═══════════════════════════════════════════════════════════════════════════════
// Government — data-gov
// ═══════════════════════════════════════════════════════════════════════════════
G('data-gov', 'Data.gov', 'Search and access US government open datasets.', 'https://catalog.data.gov/api/3',
  {},
  { p: 'US Government', u: 'https://data.gov', r: 'No published limit (no key)', docs: 'https://catalog.data.gov/api/3' },
  ['government', 'open-data', 'usa', 'datasets', 'federal'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search data.gov datasets by keyword',
      [{ s: 'query' }, { on: 'rows' }],
      '/action/package_search?q=${query}&rows=${rows}',
      { l: 'result.results', f: ['name', 'title', 'notes', 'organization', 'resources'], m: 10 }),
    M('get_dataset', 'Get Dataset', 1, 'Get metadata for a specific dataset by ID',
      [{ s: 'id' }],
      '/action/package_show?id=${id}',
      { f: ['result'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — usa-spending
// ═══════════════════════════════════════════════════════════════════════════════
G('usa-spending', 'USAspending', 'Federal government spending data from USAspending.gov.', 'https://api.usaspending.gov/api/v2',
  {},
  { p: 'US Treasury', u: 'https://api.usaspending.gov', r: 'No published limit (no key)', docs: 'https://api.usaspending.gov/docs/endpoints' },
  ['government', 'spending', 'budget', 'federal', 'usa'],
  [
    M('search_spending', 'Search Spending', 1, 'Search federal spending awards by keyword',
      [{ s: 'keyword' }],
      '/search/spending_by_award/?keyword=${keyword}&limit=10',
      { l: 'results', f: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency'], m: 10 }),
    M('get_agency', 'Get Agency', 1, 'Get spending totals for a federal agency by toptier code',
      [{ s: 'code' }],
      '/agency/${code}/',
      { f: ['name', 'abbreviation', 'budget_authority_amount', 'obligated_amount'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — fec-elections
// ═══════════════════════════════════════════════════════════════════════════════
G('fec-elections', 'FEC Campaign Finance', 'US federal election campaign finance data from the FEC.', 'https://api.open.fec.gov/v1',
  { q: 'api_key', e: 'FEC_API_KEY', d: 'Free key from api.open.fec.gov/developers' },
  { p: 'Federal Election Commission', u: 'https://api.open.fec.gov', r: '1000 req/hr (free key)', docs: 'https://api.open.fec.gov/developers' },
  ['elections', 'campaign-finance', 'fec', 'politics', 'usa'],
  [
    M('search_candidates', 'Search Candidates', 2, 'Search for federal election candidates',
      [{ s: 'name' }, { os: 'office' }],
      '/candidates/search/?name=${name}&office=${office}&per_page=10',
      { l: 'results', f: ['name', 'party', 'office', 'state', 'candidate_id', 'election_years'], m: 10 }),
    M('get_candidate_totals', 'Candidate Totals', 2, 'Get financial totals for a candidate',
      [{ s: 'candidate_id' }],
      '/candidate/${candidate_id}/totals/',
      { l: 'results', f: ['candidate_id', 'receipts', 'disbursements', 'cash_on_hand_end_period', 'cycle'], m: 5 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — congress-api
// ═══════════════════════════════════════════════════════════════════════════════
G('congress-api', 'US Congress', 'Congressional bills, members, and votes from congress.gov.', 'https://api.congress.gov/v3',
  { q: 'api_key', e: 'CONGRESS_API_KEY', d: 'Free key from api.congress.gov/sign-up' },
  { p: 'Library of Congress', u: 'https://api.congress.gov', r: '5000 req/hr (free key)', docs: 'https://api.congress.gov' },
  ['congress', 'legislation', 'bills', 'politics', 'usa'],
  [
    M('search_bills', 'Search Bills', 2, 'Search congressional bills by keyword',
      [{ s: 'query' }, { on: 'limit' }],
      '/bill?query=${query}&limit=${limit}&format=json',
      { l: 'bills', f: ['number', 'title', 'type', 'congress', 'latestAction'], m: 10 }),
    M('get_member', 'Get Member', 2, 'Get details about a member of Congress by bioguide ID',
      [{ s: 'bioguide_id' }],
      '/member/${bioguide_id}?format=json',
      { f: ['bioguideId', 'name', 'state', 'party', 'terms'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — usps-lookup
// ═══════════════════════════════════════════════════════════════════════════════
G('usps-lookup', 'ZIP Code Lookup', 'US and international postal code lookup via Zippopotam.us.', 'https://api.zippopotam.us',
  {},
  { p: 'Zippopotam.us', u: 'https://api.zippopotam.us', r: 'No published limit (no key)', docs: 'https://api.zippopotam.us' },
  ['zip', 'postal', 'address', 'location', 'usa'],
  [
    M('lookup_zip', 'Lookup ZIP', 1, 'Get city, state, and coordinates for a US ZIP code',
      [{ s: 'zip' }],
      '/us/${zip}',
      { f: ['post code', 'country', 'country abbreviation', 'places'] }),
    M('lookup_international', 'International Lookup', 1, 'Look up postal code in any country (ISO 2-letter code)',
      [{ s: 'country' }, { s: 'code' }],
      '/${country}/${code}',
      { f: ['post code', 'country', 'country abbreviation', 'places'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — uk-companies
// ═══════════════════════════════════════════════════════════════════════════════
G('uk-companies', 'UK Companies House', 'Search UK company registrations and filings.', 'https://api.company-information.service.gov.uk',
  { b: true, e: 'COMPANIES_HOUSE_API_KEY', d: 'Free key from developer.company-information.service.gov.uk' },
  { p: 'UK Companies House', u: 'https://developer.company-information.service.gov.uk', r: '600 req/5min', docs: 'https://developer.company-information.service.gov.uk/api/docs/' },
  ['uk', 'companies', 'business', 'registration', 'government'],
  [
    M('search_companies', 'Search Companies', 2, 'Search for UK companies by name',
      [{ s: 'query' }],
      '/search/companies?q=${query}&items_per_page=10',
      { l: 'items', f: ['company_number', 'title', 'company_status', 'date_of_creation', 'address'], m: 10 }),
    M('get_company', 'Get Company', 2, 'Get details of a specific UK company by number',
      [{ s: 'company_number' }],
      '/company/${company_number}',
      { f: ['company_name', 'company_number', 'company_status', 'type', 'date_of_creation', 'registered_office_address', 'sic_codes'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — canada-open
// ═══════════════════════════════════════════════════════════════════════════════
G('canada-open', 'Canada Open Data', 'Search Canadian government open datasets.', 'https://open.canada.ca/data/api/3',
  {},
  { p: 'Government of Canada', u: 'https://open.canada.ca', r: 'No published limit (no key)', docs: 'https://open.canada.ca/data/en/dataset' },
  ['canada', 'open-data', 'government', 'datasets'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search Canadian open data portal by keyword',
      [{ s: 'query' }, { on: 'rows' }],
      '/action/package_search?q=${query}&rows=${rows}',
      { l: 'result.results', f: ['name', 'title', 'notes', 'organization', 'resources'], m: 10 }),
    M('get_dataset', 'Get Dataset', 1, 'Get metadata for a specific Canadian dataset by ID',
      [{ s: 'id' }],
      '/action/package_show?id=${id}',
      { f: ['result'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — japan-estat
// ═══════════════════════════════════════════════════════════════════════════════
G('japan-estat', 'Japan e-Stat', 'Japanese government statistics from the e-Stat portal.', 'https://api.e-stat.go.jp/rest/3.0/app',
  { q: 'appId', e: 'ESTAT_APP_ID', d: 'Free key from e-stat.go.jp (registration required)' },
  { p: 'Statistics Bureau of Japan', u: 'https://www.e-stat.go.jp', r: 'No published limit', docs: 'https://www.e-stat.go.jp/api/api-info/e-stat-manual3-0' },
  ['japan', 'statistics', 'government', 'demographics', 'economics'],
  [
    M('search_statistics', 'Search Statistics', 2, 'Search Japanese statistical surveys and tables',
      [{ s: 'keyword' }, { os: 'lang' }],
      '/json/getStatsList?searchWord=${keyword}&lang=${lang}&limit=10',
      { l: 'GET_STATS_LIST.DATALIST_INF.TABLE_INF', f: ['@id', 'STAT_NAME', 'TITLE', 'SURVEY_DATE'], m: 10 }),
    M('get_stats_data', 'Get Stats Data', 2, 'Get statistical data for a specific table ID',
      [{ s: 'stats_data_id' }],
      '/json/getStatsData?statsDataId=${stats_data_id}&limit=20',
      { f: ['GET_STATS_DATA'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — south-korea
// ═══════════════════════════════════════════════════════════════════════════════
G('south-korea', 'Korea Open Data', 'South Korean government statistics and open data.', 'https://kosis.kr/openapi',
  {},
  { p: 'KOSIS (Korean Statistical Information Service)', u: 'https://kosis.kr', r: 'No published limit (no key for basic)', docs: 'https://kosis.kr/openapi/index/index.jsp' },
  ['korea', 'statistics', 'government', 'economics', 'demographics'],
  [
    M('search_statistics', 'Search Statistics', 1, 'Search Korean statistical tables',
      [{ s: 'keyword' }],
      '/Param/statisticsParameterData.json?method=getList&searchWord=${keyword}&format=json',
      { l: 'result', f: ['TBL_NM', 'TBL_ID', 'ORG_NM', 'PRD_DE'], m: 10 }),
    M('get_table', 'Get Table', 1, 'Get data from a specific statistical table',
      [{ s: 'table_id' }],
      '/Param/statisticsParameterData.json?method=getStatsData&orgId=101&tblId=${table_id}&format=json',
      { f: ['result'] }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// Government — un-data
// ═══════════════════════════════════════════════════════════════════════════════
G('un-data', 'UN Statistics', 'United Nations statistical data (population, GDP, trade).', 'https://data.un.org/ws/rest',
  {},
  { p: 'United Nations Statistics Division', u: 'https://data.un.org', r: 'No published limit (no key)', docs: 'https://data.un.org/Host.aspx?Content=API' },
  ['united-nations', 'statistics', 'global', 'population', 'economics'],
  [
    M('get_indicator', 'Get Indicator', 1, 'Get UN statistical data by dataflow and key',
      [{ s: 'dataflow' }, { s: 'key' }],
      '/data/${dataflow}/${key}?format=jsondata&detail=dataonly&lastNObservations=5',
      { f: ['dataSets', 'structure'] }),
    M('list_dataflows', 'List Dataflows', 1, 'List available UN data sources (dataflows)',
      [],
      '/dataflow/all?format=jsondata',
      { l: 'dataflows', f: ['id', 'name', 'agencyID'], m: 20 }),
  ])

console.log('\n✓ All 32 servers generated successfully.')
