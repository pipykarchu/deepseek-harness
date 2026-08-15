// @vitest-environment jsdom
/**
 * AppRoot boot-gate smoke: crystal-charge loading page until the settled
 * signal flips, then a closed magic door whose center gem the user must click
 * (status alone never opens the gate; settlement alone never enters the real
 * UI), fail-loud entry list + boot failure report, and the one-pass switch to
 * the real UI only after the door opened. The full browser chain (real module
 * system + vendored Loader + bundles) is the e2e's job; this pins the
 * shell-owned gate semantics. Stores are the kernel-own signals production
 * boot uses (shell self-sufficiency: the loading page depends on no plugin
 * package). Fake timers drive the ceremony's phase durations.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

afterEach(cleanup)
import { AppRoot, LOADING_MS, OPENING_MS, REVEAL_MS } from '@deepseek-ai/dsh-client-web/src/AppRoot.tsx'
import { createLoaderStatusStore, createSignal } from '@deepseek-ai/dsh-client-web/src/loader-status.ts'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function mount() {
  const settled = createSignal(false)
  const error = createSignal<string | undefined>(undefined)
  const status = createLoaderStatusStore()
  let renders = 0
  const utils = render(
    <AppRoot
      settled={settled}
      status={status}
      error={error}
      renderApp={() => { renders += 1; return <div data-testid="real-ui" /> }}
    />,
  )
  return { settled, status, error, counts: () => renders, ...utils }
}

describe('AppRoot', () => {
  it('shows the crystal charge page and never calls renderApp before the door opens', () => {
    const { queryByTestId, counts, getByText } = mount()
    expect(getByText('HARNESS')).toBeTruthy()
    expect(getByText('Loading plugins…')).toBeTruthy()
    expect(queryByTestId('real-ui')).toBeNull()
    expect(counts()).toBe(0)
  })

  it('all-active status alone does not open the gate (settled signal is the only key)', () => {
    const { status, queryByTestId } = mount()
    act(() => {
      status.set('a', 'active')
      status.set('b', 'active')
    })
    expect(queryByTestId('real-ui')).toBeNull()
  })

  it('lists failed entries and stays on the loading page', () => {
    const { status, getByText, queryByTestId } = mount()
    act(() => {
      status.set('@deepseek-ai/dsh-client-ui-layout', 'failed')
      status.set('ok', 'active')
    })
    expect(getByText('Failed to load plugins')).toBeTruthy()
    expect(getByText('@deepseek-ai/dsh-client-ui-layout')).toBeTruthy()
    expect(queryByTestId('real-ui')).toBeNull()
  })

  it('renders the boot failure report even when no entry projected failed', () => {
    const { error, getByText, queryByTestId } = mount()
    act(() => { error.set('web boot: 1 entry did not activate\nx: pending (waiting for service: y)') })
    expect(getByText('Failed to load plugins')).toBeTruthy()
    expect(getByText(/waiting for service/)).toBeTruthy()
    expect(queryByTestId('real-ui')).toBeNull()
  })

  it('settlement alone does not enter: the revealed door waits for the gem click', () => {
    const { settled, getByRole, queryByTestId, counts } = mount()
    act(() => { settled.set(true) })
    act(() => { vi.advanceTimersByTime(LOADING_MS) })
    // The door is closed; the settled signal is not enough to skip the ceremony.
    expect(getByRole('button', { name: '点击开启魔法之门' })).toBeTruthy()
    expect(queryByTestId('real-ui')).toBeNull()
    expect(counts()).toBe(0)
  })

  it('flipping settled and clicking the gem switches to the real UI in one pass', () => {
    const { settled, getByRole, getByTestId, getByText, queryByTestId, queryByText, counts } = mount()
    act(() => { settled.set(true) })
    act(() => { vi.advanceTimersByTime(LOADING_MS) })
    act(() => { fireEvent.click(getByRole('button', { name: '点击开启魔法之门' })) })
    act(() => { vi.advanceTimersByTime(OPENING_MS) })
    // Revealed: the portal shows, but the real UI waits for the reveal dwell.
    expect(getByText('欢迎回来，魔法师')).toBeTruthy()
    expect(queryByText('HARNESS')).toBeNull()
    expect(queryByTestId('real-ui')).toBeNull()
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    expect(getByTestId('real-ui')).toBeTruthy()
    expect(counts()).toBe(1)
  })

  it('a door opened before settlement waits at the portal until the boot settles', () => {
    const { settled, getByRole, getByText, queryByTestId } = mount()
    act(() => { vi.advanceTimersByTime(LOADING_MS) })
    act(() => { fireEvent.click(getByRole('button', { name: '点击开启魔法之门' })) })
    act(() => { vi.advanceTimersByTime(OPENING_MS) })
    expect(getByText('欢迎回来，魔法师')).toBeTruthy()
    expect(getByText('正在唤醒世界…')).toBeTruthy()
    expect(queryByTestId('real-ui')).toBeNull()
    act(() => { settled.set(true) })
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    expect(queryByTestId('real-ui')).toBeTruthy()
  })
})
