import { downloadText } from './download'

// A real browser only starts fetching the blob after click() returns, so a revoke in the
// same task kills the download outright (ERR_FILE_NOT_FOUND was observed). These tests pin
// the ordering rather than the mechanism: the URL must still be alive when click() lands,
// and must not be leaked afterwards.
test('the object URL is still alive when the anchor is clicked, and revoked after', () => {
  vi.useFakeTimers()
  const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tracker/test')
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const clicks: { href: string; download: string; revokedByNow: number }[] = []
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function click(this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download, revokedByNow: revoked.mock.calls.length })
    })
  try {
    downloadText('tracker.json', '{"a":1}')
    expect(created).toHaveBeenCalledTimes(1)
    expect(clicks).toHaveLength(1)
    expect(clicks[0].href).toBe('blob:tracker/test')
    expect(clicks[0].download).toBe('tracker.json')
    // The point of the fix: nothing had been revoked by the time the click happened.
    expect(clicks[0].revokedByNow).toBe(0)
    expect(revoked).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(revoked).toHaveBeenCalledWith('blob:tracker/test')
  } finally {
    click.mockRestore()
    created.mockRestore()
    revoked.mockRestore()
    vi.useRealTimers()
  }
})

test('the anchor does not outlive the download', () => {
  vi.useFakeTimers()
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  try {
    downloadText('tracker.json', '{}')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.runAllTimers()
  } finally {
    click.mockRestore()
    revoked.mockRestore()
    vi.useRealTimers()
  }
})
