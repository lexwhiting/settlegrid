/**
 * Consumer key revoke: the first click only asks for confirmation; the key is
 * revoked from the confirm button, and Cancel / Escape back out.
 *
 * Harness: same as api-key-reveal-dialog.test.tsx (no jsdom). react's
 * useState is mocked so each test picks the component's state, then the
 * component is called as a function and its element tree inspected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactActual from 'react'

Object.assign(globalThis, { React: ReactActual })

const { stateQueue, setters } = vi.hoisted(() => ({
  stateQueue: [] as unknown[],
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  Object.assign(globalThis, { React: actual })
  return {
    ...actual,
    useState: (initial: unknown) => {
      const setter = vi.fn()
      setters.push(setter)
      return [stateQueue.length > 0 ? stateQueue.shift() : initial, setter]
    },
  }
})

import { RevokeKeyButton } from '../revoke-key-button'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findAll(node: any, pred: (n: any) => boolean, acc: any[] = []): any[] {
  if (!node || typeof node !== 'object') return acc
  if (pred(node)) acc.push(node)
  const children = node.props?.children
  const arr = Array.isArray(children) ? children : children != null ? [children] : []
  for (const child of arr) findAll(child, pred, acc)
  return acc
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buttons = (tree: any) => findAll(tree, (n) => typeof n.props?.onClick === 'function')

beforeEach(() => {
  stateQueue.length = 0
  setters.length = 0
})

describe('RevokeKeyButton', () => {
  it('first click opens the confirmation without revoking', () => {
    const onConfirm = vi.fn()
    const tree = RevokeKeyButton({ keyPrefix: 'sg_live_abcd', onConfirm })
    const [revoke] = buttons(tree)
    expect(revoke.props['aria-label']).toBe('Revoke API key sg_live_abcd')
    revoke.props.onClick()
    expect(setters[0]).toHaveBeenCalledWith(true)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirm button revokes the key', async () => {
    stateQueue.push(true, false) // confirming, not yet revoking
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const tree = RevokeKeyButton({ keyPrefix: 'sg_live_abcd', onConfirm })
    const [confirm] = buttons(tree)
    expect(confirm.props.children).toBe('Revoke key')
    await confirm.props.onClick()
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancel closes the confirmation without revoking and takes focus', () => {
    stateQueue.push(true, false)
    const onConfirm = vi.fn()
    const tree = RevokeKeyButton({ keyPrefix: 'sg_live_abcd', onConfirm })
    const cancel = buttons(tree).find((b) => b.props.children === 'Cancel')
    expect(cancel.props.autoFocus).toBe(true)
    cancel.props.onClick()
    expect(setters[0]).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Escape closes the confirmation', () => {
    stateQueue.push(true, false)
    const tree = RevokeKeyButton({ keyPrefix: 'sg_live_abcd', onConfirm: vi.fn() })
    expect(tree.props.role).toBe('group')
    tree.props.onKeyDown({ key: 'Escape' })
    expect(setters[0]).toHaveBeenCalledWith(false)
  })

  it('names the key in the confirmation prompt', () => {
    stateQueue.push(true, false)
    const tree = RevokeKeyButton({ keyPrefix: 'sg_live_abcd', onConfirm: vi.fn() })
    const [prompt] = findAll(tree, (n) => n.type === 'span')
    expect(tree.props['aria-labelledby']).toBe(prompt.props.id)
    expect(ReactActual.Children.toArray(prompt.props.children).join('')).toContain('sg_live_abcd')
  })
})
