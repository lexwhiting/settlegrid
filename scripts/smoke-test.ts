/**
 * Smoke Test Script for SettleGrid Nuclear Expansion
 *
 * Tests all new pages, API endpoints, and features.
 * Run: npx tsx scripts/smoke-test.ts [base-url]
 * Default base URL: http://localhost:3005
 */

const BASE_URL = process.argv[2] || 'http://localhost:3005'
const results: { name: string; status: 'PASS' | 'FAIL' | 'WARN'; detail: string }[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, status: 'PASS', detail: '' })
    console.log(`  ✅ ${name}`)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name, status: 'FAIL', detail })
    console.log(`  ❌ ${name}: ${detail}`)
  }
}

async function checkPage(path: string, expectedStrings: string[]) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  for (const s of expectedStrings) {
    if (!html.includes(s)) throw new Error(`Missing: "${s.slice(0, 50)}"`)
  }
}

async function checkApi(path: string, method = 'GET', expectedStatus = 200) {
  const res = await fetch(`${BASE_URL}${path}`, { method })
  if (res.status !== expectedStatus) throw new Error(`Expected ${expectedStatus}, got ${res.status}`)
}

async function checkApiJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data || typeof data !== 'object') throw new Error('Response is not JSON object')
  return data
}

async function run() {
  console.log(`\n🔥 SettleGrid Smoke Test\n   Base URL: ${BASE_URL}\n`)

  // ─── Marketing Pages ──────────────────────────────────────────────
  console.log('\n📄 Marketing Pages:')

  await test('Homepage renders', () =>
    checkPage('/', ['Settlement Layer', 'AI Economy'])
  )
  await test('Homepage has Solutions nav', () =>
    checkPage('/', ['/solutions'])
  )
  await test('Homepage has amber-gold brand', () =>
    checkPage('/', ['#E5A336'])
  )

  await test('/solutions hub renders', () =>
    checkPage('/solutions', ['AI Service Billing Solutions'])
  )
  await test('/solutions/llm-inference renders', () =>
    checkPage('/solutions/llm-inference', ['LLM'])
  )
  await test('/solutions/browser-automation renders', () =>
    checkPage('/solutions/browser-automation', ['Browser'])
  )
  await test('/solutions/media-generation renders', () =>
    checkPage('/solutions/media-generation', ['Media'])
  )

  await test('/pricing page renders', () =>
    checkPage('/pricing', ['Progressive', 'Builder', 'Scale'])
  )
  await test('/use-cases page renders', () =>
    checkPage('/use-cases', ['Indie Developer', 'Enterprise'])
  )
  await test('/about page renders', () =>
    checkPage('/about', ['Settlement Layer', 'mission'])
  )
  await test('/changelog page renders', () =>
    checkPage('/changelog', ['Feature', 'Improvement'])
  )
  await test('/stickers page renders', () =>
    checkPage('/stickers', ['sticker'])
  )

  // ─── Explore Pages ─────────────────────────────────────────────────
  console.log('\n🔍 Explore Pages:')

  await test('/explore renders', () =>
    checkPage('/explore', ['Explore'])
  )
  await test('/explore/category/data renders', () =>
    checkPage('/explore/category/data', ['Data'])
  )
  await test('/explore/category/data/cheapest renders', () =>
    checkPage('/explore/category/data/cheapest', ['Cheapest'])
  )
  await test('/explore/category/data/top renders', () =>
    checkPage('/explore/category/data/top', ['Top'])
  )
  await test('/explore/category/data/reliable renders', () =>
    checkPage('/explore/category/data/reliable', ['Reliable'])
  )
  await test('/explore/collections renders', () =>
    checkPage('/explore/collections', ['collection'])
  )
  await test('/explore/for/langchain renders', () =>
    checkPage('/explore/for/langchain', ['LangChain'])
  )

  // ─── Learn Pages ───────────────────────────────────────────────────
  console.log('\n📚 Learn Pages:')

  await test('/learn hub renders', () =>
    checkPage('/learn', ['Learn'])
  )
  await test('/learn/glossary renders', () =>
    checkPage('/learn/glossary', ['AI Service Settlement'])
  )
  await test('/learn/how-to hub renders', () =>
    checkPage('/learn/how-to', ['How-To'])
  )
  await test('/learn/integrations hub renders', () =>
    checkPage('/learn/integrations', ['Framework'])
  )
  await test('/learn/integrations/langchain renders', () =>
    checkPage('/learn/integrations/langchain', ['LangChain'])
  )
  await test('/learn/state-of-mcp-2026 renders', () =>
    checkPage('/learn/state-of-mcp-2026', ['State of MCP'])
  )
  await test('/learn/mcp-zero-problem renders', () =>
    checkPage('/learn/mcp-zero-problem', ['Problem'])
  )
  await test('/learn/compare hub renders', () =>
    checkPage('/learn/compare', ['Compare'])
  )
  await test('/learn/compare/vs-stripe-metronome renders', () =>
    checkPage('/learn/compare/vs-stripe-metronome', ['Metronome'])
  )
  await test('/learn/compare/vs-orb renders', () =>
    checkPage('/learn/compare/vs-orb', ['Orb'])
  )
  await test('/learn/compare/vs-lago renders', () =>
    checkPage('/learn/compare/vs-lago', ['Lago'])
  )
  await test('/learn/compare/mcp-billing-platforms-2026 renders', () =>
    checkPage('/learn/compare/mcp-billing-platforms-2026', ['Billing Platforms'])
  )

  // ─── Guides ────────────────────────────────────────────────────────
  console.log('\n📖 Guides:')

  await test('/guides hub renders', () =>
    checkPage('/guides', ['Monetization'])
  )
  await test('/guides/monetize-data-tools renders', () =>
    checkPage('/guides/monetize-data-tools', ['Data'])
  )

  // ─── Blog ──────────────────────────────────────────────────────────
  console.log('\n✏️ Blog:')

  await test('/learn/blog/how-to-monetize-mcp-server renders', () =>
    checkPage('/learn/blog/how-to-monetize-mcp-server', ['Monetize'])
  )

  // ─── Onboarding ────────────────────────────────────────────────────
  console.log('\n🚀 Onboarding:')

  await test('/start page renders', () =>
    checkPage('/start', ['Paste'])
  )
  await test('/try page renders', () =>
    checkPage('/try', ['Try'])
  )
  await test('/api-monetization page renders', () =>
    checkPage('/api-monetization', ['API'])
  )

  // ─── API Endpoints ─────────────────────────────────────────────────
  console.log('\n🔌 API Endpoints:')

  await test('GET /api/v1/discover returns JSON', async () => {
    await checkApiJson('/api/v1/discover')
  })
  await test('GET /api/v1/discover/categories returns JSON', async () => {
    await checkApiJson('/api/v1/discover/categories')
  })
  await test('GET /api/v0.1/servers returns JSON', async () => {
    await checkApiJson('/api/v0.1/servers')
  })
  await test('GET /api/v0.1/x/ai.settlegrid/stats returns JSON', async () => {
    await checkApiJson('/api/v0.1/x/ai.settlegrid/stats')
  })
  await test('GET /api/developers/count returns JSON', async () => {
    const data = await checkApiJson('/api/developers/count') as Record<string, unknown>
    if (typeof data.count !== 'number') throw new Error('Missing count field')
  })

  // ─── Static Assets ─────────────────────────────────────────────────
  console.log('\n📦 Static Assets:')

  await test('llms.txt serves', async () => {
    const res = await fetch(`${BASE_URL}/llms.txt`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (!text.includes('universal')) throw new Error('Missing universal positioning')
    if (!text.includes('Service Categories')) throw new Error('Missing service categories')
  })
  await test('sitemap.xml serves', async () => {
    const res = await fetch(`${BASE_URL}/sitemap.xml`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
  await test('robots.txt serves', async () => {
    const res = await fetch(`${BASE_URL}/robots.txt`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })

  // ─── Summary ───────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warned = results.filter(r => r.status === 'WARN').length
  console.log(`\n   Results: ${passed} passed, ${failed} failed, ${warned} warnings`)
  console.log(`   Total:   ${results.length} tests\n`)

  if (failed > 0) {
    console.log('   Failed tests:')
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`     ❌ ${r.name}: ${r.detail}`)
    }
    console.log('')
    process.exit(1)
  } else {
    console.log('   🎉 All tests passed!\n')
    process.exit(0)
  }
}

run().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
