/**
 * (R)-5 / register #8 — client-side guard tests for the one-time API-key
 * reveal dialog (src/components/api-key-reveal-dialog.tsx).
 *
 * The highest-value behavior to pin is the unrecoverable-secret safety: a
 * FAILED clipboard copy must NOT dismiss the dialog (the key is shown exactly
 * once and is otherwise lost), and the key text stays rendered + selectable for
 * a manual copy. We also pin that a SUCCESSFUL copy is decoupled from dismissal.
 *
 * Harness note (no jsdom / @testing-library in this project — see
 * src/components/telemetry/__tests__/emitters.test.tsx): we mock react's hooks
 * (real hooks throw outside a renderer) and call the component as a plain
 * function, then walk the returned element tree.
 *
 * ⚠️ React shim (pre-build-audit R1 blocker): the dialog returns JSX and the
 * project compiles JSX with the CLASSIC React.createElement transform
 * (tsconfig jsx:'preserve' + no @vitejs/plugin-react + vitest env 'node').
 * Once `react` is mocked, there is no React binding in scope, so the component
 * call throws `ReferenceError: React is not defined` unless we expose the real
 * module as a classic-runtime global. We do that inside the mock factory (and
 * at top-level as belt-and-braces). The test file itself uses NO JSX so the
 * shim is exercised only by the component under test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactActual from 'react'

// Classic-runtime global so the component's compiled React.createElement(...)
// resolves once `react` is mocked below.
Object.assign(globalThis, { React: ReactActual })

const { mockCopyToClipboard, mockToast } = vi.hoisted(() => ({
  mockCopyToClipboard: vi.fn(),
  mockToast: vi.fn(),
}))

// Mock react's hooks: useState returns [initial, noopSetter], useRef returns a
// mutable box, useEffect is a noop (we drive behavior by calling handlers
// directly). All other react exports passthrough so JSX element creation works.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  // Keep the classic-runtime global pointed at the real module.
  Object.assign(globalThis, { React: actual })
  return {
    ...actual,
    useState: (initial: unknown) => [initial, vi.fn()],
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
  }
})

vi.mock('@/lib/clipboard', () => ({ copyToClipboard: mockCopyToClipboard }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: mockToast }) }))

import { ApiKeyRevealDialog } from '@/components/api-key-reveal-dialog'

/** Depth-first walk of a React element tree returning the first node matching `pred`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findInTree(node: any, pred: (n: any) => boolean): any | null {
  if (!node || typeof node !== 'object') return null
  if (pred(node)) return node
  const children = node.props?.children
  const arr = Array.isArray(children) ? children : children != null ? [children] : []
  for (const child of arr) {
    const found = findInTree(child, pred)
    if (found) return found
  }
  return null
}

/** Collect every onClick handler in the tree (Copy + Done buttons). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectOnClicks(node: any, acc: Array<(...a: unknown[]) => unknown> = []): Array<(...a: unknown[]) => unknown> {
  if (!node || typeof node !== 'object') return acc
  if (typeof node.props?.onClick === 'function') acc.push(node.props.onClick)
  const children = node.props?.children
  const arr = Array.isArray(children) ? children : children != null ? [children] : []
  for (const child of arr) collectOnClicks(child, acc)
  return acc
}

const KEY = 'sg_pub_secret1234567890'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ApiKeyRevealDialog — open state', () => {
  it('is closed when apiKey is null', () => {
    const tree = ApiKeyRevealDialog({ apiKey: null, onClose: vi.fn() })
    expect(tree.props.open).toBe(false)
  })
})

describe('ApiKeyRevealDialog — renders the secret', () => {
  it('renders the full key inside a select-all code element', () => {
    const tree = ApiKeyRevealDialog({ apiKey: KEY, onClose: vi.fn() })
    const codeNode = findInTree(
      tree,
      (n) => n.type === 'code' && typeof n.props?.className === 'string' && n.props.className.includes('select-all'),
    )
    expect(codeNode).not.toBeNull()
    expect(codeNode.props.children).toBe(KEY)
  })

  it('renders the label when provided', () => {
    const tree = ApiKeyRevealDialog({ apiKey: KEY, keyLabel: 'CI pipeline', onClose: vi.fn() })
    const labelNode = findInTree(tree, (n) => n.props?.children === 'CI pipeline')
    expect(labelNode).not.toBeNull()
  })
})

describe('ApiKeyRevealDialog — clipboard failure keeps the key (register #8)', () => {
  it('on a failed copy: shows the manual-copy error toast', async () => {
    mockCopyToClipboard.mockResolvedValueOnce(false)
    const tree = ApiKeyRevealDialog({ apiKey: KEY, onClose: vi.fn() })

    // The Copy button has autoFocus — it is the first onClick in the tree.
    const [copyOnClick] = collectOnClicks(tree)
    await copyOnClick()

    expect(mockCopyToClipboard).toHaveBeenCalledWith(KEY)
    expect(mockToast).toHaveBeenCalledWith(
      'Could not copy automatically — select the key and copy it manually before closing.',
      'error',
    )
  })

  it('on a failed copy: does NOT dismiss the dialog (the secret would be lost)', async () => {
    mockCopyToClipboard.mockResolvedValueOnce(false)
    const onClose = vi.fn()
    const tree = ApiKeyRevealDialog({ apiKey: KEY, onClose })

    const [copyOnClick] = collectOnClicks(tree)
    await copyOnClick()

    // Load-bearing: a failed copy must never close the dialog (the key is
    // unrecoverable). onClose is the dismissal path; it must not fire.
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ApiKeyRevealDialog — successful copy is decoupled from dismissal', () => {
  it('on a successful copy: shows the success toast', async () => {
    mockCopyToClipboard.mockResolvedValueOnce(true)
    const tree = ApiKeyRevealDialog({ apiKey: KEY, onClose: vi.fn() })

    const [copyOnClick] = collectOnClicks(tree)
    await copyOnClick()

    expect(mockCopyToClipboard).toHaveBeenCalledWith(KEY)
    expect(mockToast).toHaveBeenCalledWith('API key copied to clipboard.', 'success')
  })

  it('on a successful copy: still does NOT auto-dismiss (Copy is decoupled from Done)', async () => {
    mockCopyToClipboard.mockResolvedValueOnce(true)
    const onClose = vi.fn()
    const tree = ApiKeyRevealDialog({ apiKey: KEY, onClose })

    const [copyOnClick] = collectOnClicks(tree)
    await copyOnClick()

    // Copy gives feedback but leaves the modal open; the user dismisses explicitly.
    expect(onClose).not.toHaveBeenCalled()
  })
})
