/**
 * safe-egress — the ONE shared fetch-time SSRF guard.
 *
 * Every server-side fetch to a developer-/user-supplied URL (the proxy money
 * rail, webhooks, health-checks, auto-detect probes, the public serve handlers,
 * Slack/Discord notifications, the showcase tool-call registry) MUST go through
 * `safeFetch`. A sink that forgets to call it is an unguarded sink.
 *
 * There is NO network-egress firewall backstop — this app-layer guard is the
 * only defense, so it FAILS CLOSED throughout.
 *
 * Two co-load-bearing layers, both at FETCH time, neither alone complete:
 *
 *   L1 — synchronous IP-LITERAL host check. `net.connect` SKIPS a custom
 *        connect-time `lookup` when the host is already an IP literal
 *        (`isIP(host) !== 0` short-circuits DNS), so a lookup-only guard misses
 *        `169.254.169.254` / `127.0.0.1` / `[::1]` / `0.0.0.0` and every
 *        encoding `new URL()` normalizes to a literal (decimal `2130706433`,
 *        hex `0x7f.0.0.1`, octal `0177.0.0.1`, short `127.1`). L1 classifies the
 *        URL host BEFORE issuing the fetch and rejects private/reserved literals.
 *
 *   L2 — a shared undici `Agent({ connect: { lookup } })`, attached per call via
 *        `init.dispatcher`. For HOSTNAME hosts the connect-time lookup resolves
 *        every address and classifies each; any private/reserved address fails the
 *        connection. Defeats DNS rebind (validated public at registration, flipped
 *        private before the fetch). Attached per call only — never
 *        `setGlobalDispatcher` (that would route trusted crawler/Stripe fetches
 *        through it too).
 *
 *   L3 — redirects. A literal-IP `Location` ALSO skips the lookup, so the
 *        dispatcher alone does not make redirects safe. Cheap sinks pass
 *        `redirect:'error'` (no product need to follow). The proxy passes
 *        `redirect:'manual'`; we then re-run L1 on every `Location` and re-issue
 *        through the L2 dispatcher, capped at `maxRedirects` hops.
 */
import dns from 'node:dns'
import net from 'node:net'
import { Agent } from 'undici'

// ─── Error ───────────────────────────────────────────────────────────────────

/** Thrown (or surfaced via the dispatcher) when egress to an address is blocked. */
export class SsrfBlockedError extends Error {
  readonly code = 'SSRF_BLOCKED'
  readonly reason: string
  constructor(reason: string) {
    super(`Egress blocked (SSRF guard): ${reason}`)
    this.name = 'SsrfBlockedError'
    this.reason = reason
  }
}

// ─── IP classification (shared by L1 and L2) ─────────────────────────────────

export type AddressClass =
  | 'public'
  | 'unspecified'
  | 'loopback'
  | 'private'
  | 'cgnat'
  | 'link-local'
  | 'broadcast'
  | 'reserved'
  | 'malformed'
  | 'not-an-ip'

/**
 * IPv4 special-use ranges that MUST be blocked. The explicit checks in
 * `classifyV4` cover the common ones with precise labels; this BlockList is the
 * authoritative long-tail backstop (IETF protocol / TEST-NET / benchmarking /
 * 6to4-relay-anycast), so no reserved range slips through.
 */
const V4_BLOCK = (() => {
  const bl = new net.BlockList()
  const subnets: Array<[string, number]> = [
    ['0.0.0.0', 8], // "this network"
    ['10.0.0.0', 8], // RFC1918 private
    ['100.64.0.0', 10], // CGNAT (RFC6598)
    ['127.0.0.0', 8], // loopback
    ['169.254.0.0', 16], // link-local (cloud metadata)
    ['172.16.0.0', 12], // RFC1918 private
    ['192.0.0.0', 24], // IETF protocol assignments
    ['192.0.2.0', 24], // TEST-NET-1
    ['192.88.99.0', 24], // 6to4 relay anycast
    ['192.168.0.0', 16], // RFC1918 private
    ['198.18.0.0', 15], // benchmarking
    ['198.51.100.0', 24], // TEST-NET-2
    ['203.0.113.0', 24], // TEST-NET-3
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4], // reserved (incl. 255.255.255.255)
  ]
  for (const [addr, prefix] of subnets) bl.addSubnet(addr, prefix, 'ipv4')
  return bl
})()

/**
 * IPv6 special-use ranges that MUST be blocked, EXCLUDING IPv4-mapped/embedded
 * forms (`::ffff:a.b.c.d`, `::a.b.c.d`, 6to4 `2002::/16`) — those are normalized
 * to their embedded IPv4 and classified as IPv4 in `classifyV6`, because the
 * embedded address decides reachability (`::ffff:8.8.8.8` is public,
 * `::ffff:127.0.0.1` is loopback) and `net.BlockList` will not cross families.
 */
const V6_BLOCK = (() => {
  const bl = new net.BlockList()
  bl.addAddress('::', 'ipv6') // unspecified
  bl.addAddress('::1', 'ipv6') // loopback
  bl.addSubnet('fc00::', 7, 'ipv6') // unique local
  bl.addSubnet('fe80::', 10, 'ipv6') // link-local
  bl.addSubnet('ff00::', 8, 'ipv6') // multicast
  bl.addSubnet('2001::', 23, 'ipv6') // IETF protocol (Teredo/ORCHID/BMWG) — V4/V6 parity with 192.0.0/24
  bl.addSubnet('2001:db8::', 32, 'ipv6') // documentation
  bl.addSubnet('3fff::', 20, 'ipv6') // documentation (RFC9637) — inside 2000::/3
  bl.addSubnet('64:ff9b::', 96, 'ipv6') // NAT64 well-known prefix
  bl.addSubnet('100::', 64, 'ipv6') // discard-only (RFC6666)
  return bl
})()

/** Strip the surrounding brackets `new URL()` puts on IPv6 hostnames. */
function unbracket(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

/**
 * Expand a (net.isIP-validated) IPv6 string to its 16 bytes, handling `::`
 * compression and an embedded dotted-quad tail (`::ffff:127.0.0.1`). Returns
 * null on any parse anomaly → callers fail closed.
 */
function ipv6ToBytes(addr: string): Uint8Array | null {
  let s = addr.trim()
  const zone = s.indexOf('%')
  if (zone !== -1) s = s.slice(0, zone)
  if (s.length === 0) return null

  // Embedded IPv4 dotted-quad in the final segment → fold into two hextets.
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':')
    if (lastColon === -1) return null
    const v4 = s.slice(lastColon + 1).split('.')
    if (v4.length !== 4) return null
    const nums: number[] = []
    for (const o of v4) {
      if (!/^\d{1,3}$/.test(o)) return null
      const n = Number(o)
      if (n > 255) return null
      nums.push(n)
    }
    const hi = ((nums[0] << 8) | nums[1]).toString(16)
    const lo = ((nums[2] << 8) | nums[3]).toString(16)
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`
  }

  const halves = s.split('::')
  if (halves.length > 2) return null
  const parse = (part: string): number[] | null => {
    if (part === '') return []
    const out: number[] = []
    for (const g of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }
  const head = parse(halves[0])
  if (head === null) return null
  let groups: number[]
  if (halves.length === 2) {
    const tail = parse(halves[1])
    if (tail === null) return null
    const missing = 8 - head.length - tail.length
    if (missing < 0) return null
    groups = [...head, ...new Array<number>(missing).fill(0), ...tail]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 8; i++) {
    bytes[i * 2] = (groups[i] >> 8) & 0xff
    bytes[i * 2 + 1] = groups[i] & 0xff
  }
  return bytes
}

function classifyV4(ip: string): AddressClass {
  const o = ip.split('.').map(Number)
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return 'malformed'
  if (o[0] === 0) return 'unspecified' // 0.0.0.0/8
  if (o[0] === 127) return 'loopback' // 127.0.0.0/8
  if (o[0] === 10) return 'private' // 10.0.0.0/8
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return 'private' // 172.16.0.0/12
  if (o[0] === 192 && o[1] === 168) return 'private' // 192.168.0.0/16
  if (o[0] === 169 && o[1] === 254) return 'link-local' // 169.254.0.0/16 — cloud metadata
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return 'cgnat' // 100.64.0.0/10
  if (ip === '255.255.255.255') return 'broadcast'
  if (o[0] >= 224) return 'reserved' // 224/4 multicast + 240/4 reserved
  // Long-tail special ranges (IETF-protocol / TEST-NET / benchmarking / 6to4-relay).
  if (V4_BLOCK.check(ip, 'ipv4')) return 'reserved'
  return 'public'
}

function classifyV6(ip: string): AddressClass {
  const b = ipv6ToBytes(ip)
  if (!b) return 'malformed'

  const firstTenZero = b.subarray(0, 10).every((x) => x === 0)
  // IPv4-mapped ::ffff:0:0/96 → classify the embedded IPv4.
  if (firstTenZero && b[10] === 0xff && b[11] === 0xff) {
    return classifyV4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`)
  }
  // IPv4-compatible ::/96 (deprecated). `::` and `::1` are handled as the
  // embedded 0.0.0.0 / 0.0.0.1 below (which classify unspecified / public-ish);
  // pin them explicitly so they stay blocked.
  if (firstTenZero && b[10] === 0 && b[11] === 0) {
    const last4 = (b[12] << 24) | (b[13] << 16) | (b[14] << 8) | b[15]
    if (last4 === 0) return 'unspecified' // ::
    if (last4 === 1) return 'loopback' // ::1
    return classifyV4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`)
  }
  // 6to4 2002::/16 → embedded IPv4 lives in bytes 2..5.
  if (b[0] === 0x20 && b[1] === 0x02) {
    return classifyV4(`${b[2]}.${b[3]}.${b[4]}.${b[5]}`)
  }
  // Global unicast is ONLY 2000::/3 (RFC4291). Every other native-IPv6 range is
  // reserved/special-purpose — fail closed (block) rather than allow. This closes
  // the IPv6 fail-OPEN class an IP-literal host would otherwise slip past (L1 is
  // the sole adjudicator for literals — net.connect skips the L2 lookup): site-local
  // fec0::/10, IETF-reserved 4000::/3 / 8000::/3 / c000::/3, SRv6 5f00::/16, and the
  // local-use NAT64 prefixes all live outside 2000::/3. The embedded IPv4-mapped /
  // compatible / 6to4 forms were already folded to their embedded IPv4 above.
  if ((b[0] & 0xe0) !== 0x20) return 'reserved'
  // Within global unicast, the BlockList still catches the documented/protocol
  // sub-ranges (2001::/23, 2001:db8::/32, 3fff::/20).
  if (V6_BLOCK.check(ip, 'ipv6')) return 'reserved'
  return 'public'
}

/**
 * Classify an IP string. Returns `'public'` for a globally-routable address,
 * otherwise a non-public reason. Anything that is not a recognizable IP returns
 * `'not-an-ip'` (blocked) — fail closed.
 */
export function classifyAddress(ip: string): AddressClass {
  const fam = net.isIP(ip)
  if (fam === 4) return classifyV4(ip)
  if (fam === 6) return classifyV6(ip)
  return 'not-an-ip'
}

/** True iff `ip` is a globally-routable (non-private, non-reserved) address. */
export function isPublicAddress(ip: string): boolean {
  return classifyAddress(ip) === 'public'
}

// ─── Scheme + L1 literal-host pre-filter (synchronous) ───────────────────────

const DEFAULT_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:'])

export interface SafeUrlOptions {
  /** Scheme allowlist. Defaults to `http:`/`https:`. Pass `['https:']` for https-only. */
  allowedProtocols?: ReadonlySet<string> | string[]
}

function protocolSet(opts?: SafeUrlOptions): ReadonlySet<string> {
  if (!opts?.allowedProtocols) return DEFAULT_PROTOCOLS
  return Array.isArray(opts.allowedProtocols) ? new Set(opts.allowedProtocols) : opts.allowedProtocols
}

/**
 * Parse + scheme-allowlist a URL. Rejects `file:`/`data:`/`blob:`/`gopher:`/etc.
 * and anything not in `allowedProtocols`. Throws `SsrfBlockedError`.
 */
export function assertHttpUrl(url: string | URL, opts?: SafeUrlOptions): URL {
  let u: URL
  try {
    u = typeof url === 'string' ? new URL(url) : url
  } catch {
    throw new SsrfBlockedError('invalid-url')
  }
  if (!protocolSet(opts).has(u.protocol)) throw new SsrfBlockedError(`scheme:${u.protocol}`)
  return u
}

/**
 * Synchronous, fail-closed guard: scheme allowlist + L1 literal-host check.
 * Use this BEFORE any irreversible payment capture/settlement on a prepaid rail
 * (the proxy money path) so a private/reserved literal endpoint is rejected
 * pre-charge. Hostname hosts pass here (no synchronous DNS) and are caught by
 * the L2 dispatcher at fetch time. Throws `SsrfBlockedError`.
 */
export function assertSafeUrlSync(url: string | URL, opts?: SafeUrlOptions): URL {
  const u = assertHttpUrl(url, opts)
  const host = unbracket(u.hostname)
  if (net.isIP(host) !== 0) {
    const cls = classifyAddress(host)
    if (cls !== 'public') throw new SsrfBlockedError(`literal:${host}:${cls}`)
  }
  return u
}

/**
 * Cheap synchronous predicate for REGISTRATION-time UX (supersedes the four
 * divergent string-only guards). Returns false for: an unparseable URL, a
 * disallowed scheme, a private/reserved IP literal, or an obviously-internal
 * hostname. Returns true for a public literal OR any other hostname (the
 * load-bearing block for rebind-capable hostnames is L1+L2 at fetch time).
 */
export function isPublicUrlString(url: string, opts?: SafeUrlOptions): boolean {
  let u: URL
  try {
    u = assertSafeUrlSync(url, opts)
  } catch {
    return false
  }
  const host = unbracket(u.hostname).toLowerCase()
  if (host === 'localhost' || host === 'metadata.google.internal') return false
  if (host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local') || host.endsWith('.corp')) {
    return false
  }
  return true
}

// ─── L2 dispatcher (DNS resolve → classify each → block-or-pass) ─────────────

/** Pure decision over a resolver result set — block if ANY address is non-public. */
export function screenResolvedAddresses(
  addresses: ReadonlyArray<{ address: string }>,
): { ok: true } | { ok: false; reason: string } {
  if (addresses.length === 0) return { ok: false, reason: 'no-address' }
  for (const a of addresses) {
    const cls = classifyAddress(a.address)
    if (cls !== 'public') return { ok: false, reason: `resolved:${a.address}:${cls}` }
  }
  return { ok: true }
}

/**
 * undici/net connect-time lookup. Resolves ALL addresses, classifies each, and
 * fails the connection (propagated error) if any is private/reserved. Matches
 * undici 5.29's contract: it invokes this with `all: true` and expects the
 * ARRAY callback form `cb(null, LookupAddress[])` (the single-address form
 * throws "Invalid IP address: undefined") — verified live. We force `all: true`
 * regardless so the contract holds.
 */
const validatingLookup: net.LookupFunction = (hostname, options, callback) => {
  const allOpts: dns.LookupAllOptions = { ...(options as dns.LookupOptions), all: true }
  dns.lookup(hostname, allOpts, (err, addresses) => {
    if (err) return callback(err, [], 0)
    const verdict = screenResolvedAddresses(addresses)
    if (!verdict.ok) {
      return callback(new SsrfBlockedError(verdict.reason) as NodeJS.ErrnoException, [], 0)
    }
    callback(null, addresses)
  })
}

// `autoSelectFamily: true` pins undici to invoke `connect.lookup` in the
// `{ all: true }` ARRAY-callback form regardless of Node's process-global
// `autoSelectFamily` default — so `validatingLookup` keeps matching the contract
// (and L2 stays engaged) even if a future Node flips that default or a dependency
// calls `net.setDefaultAutoSelectFamily(false)`. (It is already the Node ≥20
// default; pinning makes the L2 lookup-shape contract explicit rather than
// inherited.)
const ssrfDispatcher = new Agent({ autoSelectFamily: true, connect: { lookup: validatingLookup } })

/**
 * The shared per-process validating dispatcher — a single module-level Agent
 * (with undici keep-alive pooling) attached PER CALL via `init.dispatcher`
 * (never `setGlobalDispatcher`, which would route trusted crawler/Stripe fetches
 * through it too). Pooled reuse only targets the already-screened IP, and the
 * classify/screen functions are pure, so the shared instance is safe under
 * concurrency. Exposed for tests / advanced callers.
 */
export function getSsrfDispatcher(): Agent {
  return ssrfDispatcher
}

// ─── safeFetch ───────────────────────────────────────────────────────────────

type RawInit = RequestInit & { dispatcher?: unknown; duplex?: string }

export interface SafeFetchInit extends Omit<RequestInit, 'redirect'> {
  /**
   * `'error'` (default) — any 3xx throws; correct for cheap sinks with no
   * product need to follow redirects.
   * `'manual'` — follow up to `maxRedirects` hops, re-running L1 on every
   * `Location` and re-issuing through the L2 dispatcher; correct for the proxy.
   */
  redirect?: 'error' | 'manual'
  /** Max redirect hops for `redirect:'manual'`. Default 3. */
  maxRedirects?: number
  /** Scheme allowlist; defaults to `http:`/`https:`. Pass `['https:']` for https-only. */
  allowedProtocols?: ReadonlySet<string> | string[]
  /** Streaming request-body flag forwarded to fetch (e.g. `'half'`). */
  duplex?: string
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

/** A body that can be safely re-sent on a redirect hop (streams cannot). */
function isReplayableBody(body: unknown): boolean {
  if (body === undefined || body === null) return true
  if (typeof body === 'string') return true
  if (body instanceof Uint8Array) return true
  if (body instanceof ArrayBuffer) return true
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return true
  return false
}

interface ManualFollowControls {
  dispatcher: Agent
  /** Validate the initial host with L1 before the first hop. Production = true. */
  guardInitial: boolean
}

/** Strip the safe-egress-only keys (and optionally method/body) so what reaches
 *  `fetch` is a plain RequestInit — no unknown props leak to undici. */
function fetchRest(init: SafeFetchInit, omitBodyMethod: boolean): RawInit {
  const r: RawInit = { ...(init as RawInit) }
  delete (r as Record<string, unknown>).redirect
  delete (r as Record<string, unknown>).maxRedirects
  delete (r as Record<string, unknown>).allowedProtocols
  if (omitBodyMethod) {
    delete (r as Record<string, unknown>).method
    delete (r as Record<string, unknown>).body
    delete (r as Record<string, unknown>).duplex
  }
  return r
}

/**
 * Bounded, re-validating redirect follower for the proxy. Each `Location` is
 * resolved against the current URL and re-run through L1 (literal block) before
 * being re-issued through the L2 dispatcher. Exported for tests so the loop can
 * be driven against a loopback stand-in server with a permissive dispatcher
 * while the REAL L1 still adjudicates every `Location`.
 */
export async function followManual(
  initialUrl: string,
  init: SafeFetchInit,
  maxRedirects: number,
  controls: ManualFollowControls,
): Promise<Response> {
  const opts: SafeUrlOptions = { allowedProtocols: init.allowedProtocols }
  let currentUrl = controls.guardInitial
    ? assertSafeUrlSync(initialUrl, opts).toString()
    : assertHttpUrl(initialUrl, opts).toString()

  const rawInit = init as RawInit
  const baseRest = fetchRest(init, true)
  let curMethod = (rawInit.method ?? 'GET').toUpperCase()
  let curBody: BodyInit | null | undefined = rawInit.body as BodyInit | null | undefined
  let curDuplex = rawInit.duplex
  const replayable = isReplayableBody(curBody)

  for (let hop = 0; ; hop++) {
    const perHop: RawInit = {
      ...baseRest,
      method: curMethod,
      redirect: 'manual',
      dispatcher: controls.dispatcher,
    }
    if (curBody !== undefined && curBody !== null) {
      perHop.body = curBody
      if (curDuplex) perHop.duplex = curDuplex
    }
    const res = await fetch(currentUrl, perHop as RequestInit)
    if (!isRedirectStatus(res.status)) return res
    const location = res.headers.get('location')
    if (!location) return res // 3xx without a Location — hand back as-is.
    // Done with this hop's body — cancel it BEFORE the hop-cap / blocked-Location
    // throws below, so an error path never leaks the undici connection.
    await res.body?.cancel().catch(() => {})
    if (hop >= maxRedirects) throw new SsrfBlockedError(`too-many-redirects:${maxRedirects}`)

    // L1 re-check on the next hop (a literal-IP Location skips the L2 lookup).
    const next = assertSafeUrlSync(new URL(location, currentUrl).toString(), opts).toString()

    const status = res.status
    if (status === 303 || ((status === 301 || status === 302) && curMethod !== 'GET' && curMethod !== 'HEAD')) {
      // 303 (and POST→GET on 301/302) drops to a bodyless GET.
      curMethod = 'GET'
      curBody = undefined
      curDuplex = undefined
    } else if (curBody !== undefined && curBody !== null) {
      // 307/308 (or same-method 301/302) must replay the body.
      if (!replayable) throw new SsrfBlockedError('redirect-unreplayable-body')
      curDuplex = undefined // a string/buffer body never needs duplex
    }
    currentUrl = next
  }
}

/**
 * The ONE guarded fetch. Use it for EVERY server-side fetch to a
 * developer-/user-supplied URL. Fails closed: a blocked address, DNS error,
 * resolver timeout, or disallowed scheme rejects rather than connecting.
 */
export async function safeFetch(url: string | URL, init: SafeFetchInit = {}): Promise<Response> {
  const target = typeof url === 'string' ? url : url.toString()
  const { redirect = 'error', maxRedirects = 3 } = init

  if (redirect === 'manual') {
    return followManual(target, init, maxRedirects, { dispatcher: ssrfDispatcher, guardInitial: true })
  }

  // Cheap path: validate the literal host (L1), then a single request through
  // the L2 dispatcher with redirect:'error' (any 3xx throws → blocked).
  const u = assertSafeUrlSync(target, { allowedProtocols: init.allowedProtocols })
  const fetchInit: RawInit = { ...fetchRest(init, false), redirect: 'error', dispatcher: ssrfDispatcher }
  return fetch(u.toString(), fetchInit as RequestInit)
}
