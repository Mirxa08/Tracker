import { act, renderHook } from '@testing-library/react'
import { imageObjectUrl } from '../persistence/images'
import { useImageUrl } from './useImageUrl'

vi.mock('../persistence/images', () => ({ imageObjectUrl: vi.fn() }))

const lookup = vi.mocked(imageObjectUrl)

function deferred() {
  let resolve!: (value: string | null) => void
  const promise = new Promise<string | null>((r) => { resolve = r })
  return { promise, resolve }
}

let revoke: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  lookup.mockReset()
  revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => revoke.mockRestore())

test('never renders the old url once the image id has changed', async () => {
  const second = deferred()
  lookup.mockResolvedValueOnce('blob:first').mockReturnValueOnce(second.promise)
  const rendered: Array<string | null> = []
  const { rerender } = renderHook(({ id }) => {
    const url = useImageUrl(id)
    rendered.push(url)
    return url
  }, { initialProps: { id: 'a' } })
  await act(async () => {})
  expect(rendered.at(-1)).toBe('blob:first')

  const before = rendered.length
  rerender({ id: 'b' })
  expect(revoke).toHaveBeenCalledWith('blob:first')
  expect(rendered.slice(before)).not.toContain('blob:first')

  await act(async () => { second.resolve('blob:second') })
  expect(rendered.at(-1)).toBe('blob:second')
})

test('renders no url when the new id resolves to nothing', async () => {
  lookup.mockResolvedValueOnce('blob:first').mockResolvedValueOnce(null)
  const rendered: Array<string | null> = []
  const { rerender } = renderHook(({ id }) => {
    const url = useImageUrl(id)
    rendered.push(url)
    return url
  }, { initialProps: { id: 'a' } })
  await act(async () => {})
  const before = rendered.length
  rerender({ id: 'gone' })
  await act(async () => {})
  expect(rendered.slice(before)).not.toContain('blob:first')
  expect(rendered.at(-1)).toBeNull()
})

test('revokes a url that resolves after the effect was cancelled', async () => {
  const late = deferred()
  lookup.mockReturnValueOnce(late.promise)
  const { unmount } = renderHook(() => useImageUrl('a'))
  unmount()
  expect(revoke).not.toHaveBeenCalled()
  await act(async () => { late.resolve('blob:late') })
  expect(revoke).toHaveBeenCalledWith('blob:late')
})

test('never renders a revoked url when the same id comes back (A -> undefined -> A)', async () => {
  const again = deferred()
  lookup.mockResolvedValueOnce('blob:a1').mockReturnValueOnce(again.promise)
  const rendered: Array<string | null> = []
  const { rerender } = renderHook(({ id }: { id: string | undefined }) => {
    const url = useImageUrl(id)
    rendered.push(url)
    return url
  }, { initialProps: { id: 'a' as string | undefined } })
  await act(async () => {})
  expect(rendered.at(-1)).toBe('blob:a1')

  rerender({ id: undefined })
  expect(revoke).toHaveBeenCalledWith('blob:a1')
  const before = rendered.length
  rerender({ id: 'a' })
  expect(rendered.slice(before)).not.toContain('blob:a1')

  await act(async () => { again.resolve('blob:a2') })
  expect(rendered.at(-1)).toBe('blob:a2')
})

test('returns null when there is no image id', () => {
  const { result } = renderHook(() => useImageUrl(undefined))
  expect(result.current).toBeNull()
  expect(lookup).not.toHaveBeenCalled()
})

test('a rejected lookup yields no url, does not throw, and leaves no unhandled rejection', async () => {
  // The guarantee must come from the hook's own .catch, not from the runner's exit code.
  const nodeProcess = (globalThis as unknown as {
    process: {
      on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
      off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
    }
  }).process
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => { unhandled.push(reason) }
  nodeProcess.on('unhandledRejection', onUnhandled)
  try {
    lookup.mockRejectedValueOnce(new Error('idb exploded'))
    const rendered: Array<string | null> = []
    const { result } = renderHook(() => {
      const url = useImageUrl('broken')
      rendered.push(url)
      return url
    })
    await act(async () => {})
    // Let Node run its unhandled-rejection check, which happens after the microtask queue drains.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current).toBeNull()
    expect(rendered.every((url) => url === null)).toBe(true)
    expect(revoke).not.toHaveBeenCalled()
    expect(unhandled).toEqual([])
  } finally {
    nodeProcess.off('unhandledRejection', onUnhandled)
  }
})

test('after a rejected lookup the next id still resolves normally', async () => {
  lookup.mockRejectedValueOnce(new Error('idb exploded')).mockResolvedValueOnce('blob:ok')
  const { result, rerender } = renderHook(({ id }) => useImageUrl(id), { initialProps: { id: 'broken' } })
  await act(async () => {})
  expect(result.current).toBeNull()
  rerender({ id: 'fine' })
  await act(async () => {})
  expect(result.current).toBe('blob:ok')
})
