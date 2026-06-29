/**
 * safe-egress — the END-TO-END SSRF bypass matrix.
 *
 * Teeth requirement (handoff §2.4 / audit R6+R10): the literal-IP rejects are
 * asserted through the REAL `safeFetch` with NO `lookup` stub, because they are
 * caught by L1 (the synchronous URL-host check) — `net.connect` SKIPS the
 * connect-time lookup for IP-literal hosts, so a `classifyAddress(resolvedIP)`
 * assertion would FALSE-GREEN. The redirect-to-literal block runs the loop's
 * REAL L1 against a loopback stand-in server.
 */
import { describe, it, expect, afterAll } from 'vitest'
import http from 'node:http'
import { Agent } from 'undici'
import {
  classifyAddress,
  isPublicAddress,
  assertHttpUrl,
  assertSafeUrlSync,
  isPublicUrlString,
  screenResolvedAddresses,
  safeFetch,
  followManual,
  SsrfBlockedError,
} from '@/lib/safe-egress'

// ─── classifyAddress matrix ──────────────────────────────────────────────────

describe('classifyAddress — BLOCK (under-block = SSRF survives)', () => {
  const blocked: Array<[string, string]> = [
    ['0.0.0.0', 'unspecified'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.255', 'loopback'],
    ['10.0.0.1', 'private'],
    ['10.255.255.255', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.168.1.1', 'private'],
    ['169.254.169.254', 'link-local'], // AWS/GCP metadata
    ['100.64.0.1', 'cgnat'],
    ['192.0.0.1', 'reserved'], // IETF protocol
    ['192.0.2.5', 'reserved'], // TEST-NET-1
    ['198.18.0.1', 'reserved'], // benchmarking
    ['198.51.100.7', 'reserved'], // TEST-NET-2
    ['203.0.113.9', 'reserved'], // TEST-NET-3
    ['192.88.99.1', 'reserved'], // 6to4 relay anycast
    ['224.0.0.1', 'reserved'], // multicast
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'broadcast'],
    // IPv6
    ['::', 'unspecified'],
    ['::1', 'loopback'],
    ['fc00::1', 'reserved'], // unique-local
    ['fd12:3456::1', 'reserved'],
    ['fe80::1', 'reserved'], // link-local
    ['ff02::1', 'reserved'], // multicast
    ['2001:db8::1', 'reserved'], // documentation
    ['64:ff9b::1', 'reserved'], // NAT64
    ['100::1', 'reserved'], // discard-only
    // IPv4-mapped / embedded IPv6 — the classifier MUST normalize these
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:169.254.169.254', 'link-local'],
    ['::ffff:7f00:1', 'loopback'], // hex form of ::ffff:127.0.0.1 (what new URL emits)
    ['::ffff:a9fe:a9fe', 'link-local'], // hex form of ::ffff:169.254.169.254
    ['::ffff:10.0.0.1', 'private'],
    ['::127.0.0.1', 'loopback'], // IPv4-compatible (deprecated)
    ['2002:7f00:1::', 'loopback'], // 6to4 wrapping 127.0.0.1
    ['2002:a9fe:a9fe::', 'link-local'], // 6to4 wrapping 169.254.169.254
    // ── ③ deep-audit fold: complete the IPv6 fail-OPEN class ──
    // Global unicast is ONLY 2000::/3 (RFC 4291); anything outside it is
    // reserved/special-purpose and was classifying 'public' (fail-OPEN). As an
    // IP literal, net.connect skips the L2 lookup, so L1 was the only adjudicator
    // and admitted these end-to-end.
    ['fec0::1', 'reserved'], // deprecated site-local (RFC 3879)
    ['feff::1', 'reserved'], // top of fec0::/10
    ['5f00::1', 'reserved'], // SRv6 (RFC 9602) — outside 2000::/3
    ['64:ff9b:1::1', 'reserved'], // local-use NAT64 (RFC 8215)
    ['4000::1', 'reserved'], // IETF-reserved (4000::/3)
    ['8000::1', 'reserved'], // IETF-reserved (8000::/3)
    ['c000::1', 'reserved'], // IETF-reserved (c000::/3)
    // In-2000::/3 IANA special-purpose ranges (V4/V6 symmetry: V4_BLOCK already
    // blocks the IPv4 IETF-protocol/benchmarking analogues).
    ['2001::1', 'reserved'], // Teredo 2001::/32 ⊂ 2001::/23
    ['2001:10::1', 'reserved'], // ORCHID (2001:10::/28)
    ['2001:20::1', 'reserved'], // ORCHIDv2 (2001:20::/28)
    ['3fff::1', 'reserved'], // documentation (RFC 9637, 3fff::/20)
  ]
  it.each(blocked)('blocks %s as %s', (ip, reason) => {
    expect(classifyAddress(ip)).toBe(reason)
    expect(isPublicAddress(ip)).toBe(false)
  })

  it('blocks a non-IP string (fail closed)', () => {
    expect(classifyAddress('not-an-ip')).toBe('not-an-ip')
    expect(isPublicAddress('example.com')).toBe(false)
  })
})

describe('classifyAddress — ALLOW (over-block = the money path breaks)', () => {
  const allowed = [
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34', // example.com
    '140.82.121.4', // github.com
    '2606:4700:4700::1111', // Cloudflare DNS v6
    '2001:4860:4860::8888', // Google DNS v6
    '::ffff:8.8.8.8', // IPv4-mapped PUBLIC must stay public
    '2002:0808:0808::', // 6to4 wrapping 8.8.8.8 → public
    // ── ③ deep-audit fold: prove the 2000::/3 whitelist does NOT over-block real
    // global-unicast (over-block = money-path outage) ──
    '2400:cb00:2049::1', // Cloudflare (APNIC space)
    '2a00:1450:4001:81b::200e', // Google EU
    '2620:0:ccc::2', // OpenDNS
    '2001:0200::1', // APNIC 2001:0200::/23 — just ABOVE the 2001::/23 special block
    '2001:4860:4860::8844', // Google DNS (well above 2001::/23)
  ]
  it.each(allowed)('allows %s', (ip) => {
    expect(classifyAddress(ip)).toBe('public')
    expect(isPublicAddress(ip)).toBe(true)
  })
})

// ─── scheme + L1 literal sync guard ──────────────────────────────────────────

describe('assertHttpUrl — scheme allowlist', () => {
  it.each(['file:///etc/passwd', 'data:text/html,x', 'blob:abc', 'gopher://x', 'ftp://x'])(
    'rejects %s',
    (u) => {
      expect(() => assertHttpUrl(u)).toThrow(SsrfBlockedError)
    },
  )
  it('accepts http/https', () => {
    expect(assertHttpUrl('http://example.com/').protocol).toBe('http:')
    expect(assertHttpUrl('https://example.com/').protocol).toBe('https:')
  })
  it('honors an https-only allowlist', () => {
    expect(() => assertHttpUrl('http://example.com/', { allowedProtocols: ['https:'] })).toThrow(
      SsrfBlockedError,
    )
  })
  it('rejects an unparseable URL', () => {
    expect(() => assertHttpUrl('http://')).toThrow(SsrfBlockedError)
  })
})

describe('assertSafeUrlSync — L1 literal-host rejects (incl. URL-normalized encodings)', () => {
  const literals = [
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://0.0.0.0/',
    'http://2130706433/', // decimal → 127.0.0.1
    'http://0x7f.0.0.1/', // hex → 127.0.0.1
    'http://0177.0.0.1/', // octal → 127.0.0.1 (dns.lookup would NOT decode this; new URL does)
    'http://127.1/', // short → 127.0.0.1
    'http://[::ffff:127.0.0.1]/', // mapped
    'http://192.168.1.1/',
    'http://10.0.0.5/',
  ]
  it.each(literals)('rejects %s', (u) => {
    expect(() => assertSafeUrlSync(u)).toThrow(SsrfBlockedError)
  })
  it('allows a public literal (no over-block)', () => {
    expect(assertSafeUrlSync('http://8.8.8.8/').hostname).toBe('8.8.8.8')
    expect(assertSafeUrlSync('https://1.1.1.1/').hostname).toBe('1.1.1.1')
  })
  it('allows a hostname (deferred to L2 at fetch time)', () => {
    expect(assertSafeUrlSync('https://api.example.com/v1').hostname).toBe('api.example.com')
  })
})

describe('isPublicUrlString — registration-time UX pre-check (guard collapse)', () => {
  it('rejects private literals, bad schemes, and obvious internal hostnames', () => {
    for (const u of [
      'http://127.0.0.1/',
      'http://169.254.169.254/',
      'http://2130706433/',
      'ftp://example.com/',
      'http://localhost/',
      'http://foo.internal/',
      'http://db.local/',
      'http://metadata.google.internal/',
      'not a url',
    ]) {
      expect(isPublicUrlString(u)).toBe(false)
    }
  })
  it('accepts public hostnames and public literals', () => {
    expect(isPublicUrlString('https://api.acme.com/webhook')).toBe(true)
    expect(isPublicUrlString('http://8.8.8.8/')).toBe(true)
  })
  it('honors https-only for callers that require it', () => {
    expect(isPublicUrlString('http://api.acme.com/', { allowedProtocols: ['https:'] })).toBe(false)
    expect(isPublicUrlString('https://api.acme.com/', { allowedProtocols: ['https:'] })).toBe(true)
  })
})

// ─── L2 resolver decision ────────────────────────────────────────────────────

describe('screenResolvedAddresses — L2 block-if-ANY-private', () => {
  it('blocks when any resolved address is private (rebind defeat)', () => {
    expect(screenResolvedAddresses([{ address: '93.184.216.34' }, { address: '127.0.0.1' }])).toEqual({
      ok: false,
      reason: 'resolved:127.0.0.1:loopback',
    })
  })
  it('blocks metadata IP', () => {
    expect(screenResolvedAddresses([{ address: '169.254.169.254' }]).ok).toBe(false)
  })
  it('allows when all resolved addresses are public', () => {
    expect(screenResolvedAddresses([{ address: '8.8.8.8' }, { address: '2606:4700:4700::1111' }])).toEqual({
      ok: true,
    })
  })
  it('blocks an empty result (fail closed)', () => {
    expect(screenResolvedAddresses([]).ok).toBe(false)
  })
})

// ─── safeFetch END-TO-END (REAL dispatcher, NO stub) ─────────────────────────

describe('safeFetch — L1 literal-IP rejects synchronously, before any connect', () => {
  const literals = [
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/iam/',
    'http://[::1]/',
    'http://0.0.0.0/',
    'http://2130706433/',
    'http://0x7f.0.0.1/',
    'http://0177.0.0.1/',
    'http://127.1/',
    'http://[::ffff:127.0.0.1]/',
  ]
  it.each(literals)('rejects %s', async (u) => {
    await expect(safeFetch(u)).rejects.toBeInstanceOf(SsrfBlockedError)
  })

  it('rejects disallowed schemes', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toBeInstanceOf(SsrfBlockedError)
  })
})

describe('safeFetch — L2 hostname/rebind block (real dispatcher, discriminating)', () => {
  it('blocks a loopback-resolving hostname WITHOUT reaching the server (proves the dispatcher fired)', async () => {
    // Teeth: the prior test used localhost:1, but port 1 is on undici's WHATWG
    // bad-ports list → rejected BEFORE the connect-time lookup ever runs, so a
    // toBeTruthy() rejection passed even if the dispatcher were detached. Here we
    // (a) use the server's REAL ephemeral (non-blocked) port so the block can
    // ONLY come from L2, (b) assert the block is an SsrfBlockedError (the resolve
    // classify), and (c) assert the live server was NEVER reached (hits===0).
    // Detaching `dispatcher: ssrfDispatcher` from safeFetch makes this go RED:
    // the fetch would connect → hits===1 → no SSRF rejection.
    let hits = 0
    const s = await startServer((_req, res) => {
      hits++
      res.writeHead(200)
      res.end('reached')
    })
    try {
      const port = new URL(s.url).port // a high ephemeral port — not a bad port
      let err: unknown
      try {
        // hostname 'localhost' (NOT a literal) → L1 passes → L2 lookup resolves
        // 127.0.0.1/::1 → classify → block before connect.
        await safeFetch(`http://localhost:${port}/`)
      } catch (e) {
        err = e
      }
      expect(err, 'L2 must reject a loopback-resolving hostname').toBeDefined()
      const blob = `${(err as Error)?.name}|${(err as Error)?.message}|${String((err as { cause?: unknown })?.cause)}`
      expect(blob).toMatch(/SsrfBlockedError|SSRF guard|resolved:[^|]*(loopback|link-local|private|unspecified)/)
      expect(hits, 'the dispatcher must block BEFORE the connection reaches the server').toBe(0)
    } finally {
      s.close()
    }
  })
})

// ─── redirect handling (L3) ──────────────────────────────────────────────────

function startServer(handler: http.RequestListener): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() })
    })
  })
}

describe('safeFetch redirect:manual — re-validates every Location with L1', () => {
  // A permissive dispatcher lets the loop REACH the loopback stand-in server
  // (production would block it at L1); the BLOCK below is performed by the REAL
  // L1 on the literal Location, which is the property under test.
  const permissive = new Agent()
  const servers: Array<() => void> = []
  afterAll(() => {
    servers.forEach((c) => c())
    permissive.close()
  })

  it('blocks a redirect to a LITERAL private IP (not a hostname Location)', async () => {
    const s = await startServer((_req, res) => {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' })
      res.end()
    })
    servers.push(s.close)
    await expect(
      followManual(s.url, { redirect: 'manual' }, 3, { dispatcher: permissive, guardInitial: false }),
    ).rejects.toMatchObject({ code: 'SSRF_BLOCKED', reason: expect.stringContaining('169.254.169.254') })
  })

  it('blocks a redirect to [::1]', async () => {
    const s = await startServer((_req, res) => {
      res.writeHead(307, { Location: 'http://[::1]:9/' })
      res.end()
    })
    servers.push(s.close)
    await expect(
      followManual(s.url, { redirect: 'manual' }, 3, { dispatcher: permissive, guardInitial: false }),
    ).rejects.toBeInstanceOf(SsrfBlockedError)
  })

  it('enforces the redirect hop cap', async () => {
    const s = await startServer((_req, res) => {
      res.writeHead(302, { Location: 'http://169.254.169.254/' })
      res.end()
    })
    servers.push(s.close)
    await expect(
      followManual(s.url, { redirect: 'manual' }, 0, { dispatcher: permissive, guardInitial: false }),
    ).rejects.toMatchObject({ reason: expect.stringContaining('too-many-redirects') })
  })

  // ── ③ deep-audit fold: prepaid money-rail redirect-cap regression ──
  // A legit, fully-public endpoint emitting ≥4 redirects was charged-but-
  // undelivered (F3) under the build's cap of 3. The proxy now passes a higher
  // cap; assert a 4-hop public chain DELIVERS at a raised cap but is still bounded.
  it('follows a 4-redirect public chain when the cap allows it (no over-block F3)', async () => {
    let hop = 0
    const s = await startServer((_req, res) => {
      if (hop < 4) {
        hop++
        // Redirect to a HOSTNAME Location (localhost) so the per-hop L1 admits it
        // (a literal 127.0.0.1 Location would be correctly blocked); the permissive
        // dispatcher resolves localhost back to the loopback stand-in.
        res.writeHead(302, { Location: `http://localhost:${port}/hop${hop}` })
        res.end()
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('delivered')
      }
    })
    servers.push(s.close)
    const port = new URL(s.url).port
    const start = `http://localhost:${port}/`
    // cap 3 (the build default) BLOCKS the 4th hop → the documented regression.
    await expect(
      followManual(start, { redirect: 'manual' }, 3, { dispatcher: permissive, guardInitial: false }),
    ).rejects.toMatchObject({ reason: expect.stringContaining('too-many-redirects') })
    // the proxy's raised cap (10) DELIVERS — every hop still re-validated by L1.
    hop = 0
    const r = await followManual(start, { redirect: 'manual' }, 10, {
      dispatcher: permissive,
      guardInitial: false,
    })
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('delivered')
  })

  it('returns a non-redirect response unchanged (happy path)', async () => {
    const s = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
    })
    servers.push(s.close)
    const r = await followManual(s.url, { redirect: 'manual' }, 3, {
      dispatcher: permissive,
      guardInitial: false,
    })
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('ok')
  })

  it('guards the initial host in production mode (guardInitial:true)', async () => {
    // The production entry point blocks a loopback initial host at L1.
    await expect(safeFetch('http://127.0.0.1:1/', { redirect: 'manual' })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    )
  })
})
