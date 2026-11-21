export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // click() only *schedules* the download; the browser fetches the blob afterwards. Revoking
  // in the same task tears the URL down before that fetch happens, and the download fails
  // with ERR_FILE_NOT_FOUND. A macrotask later the fetch has started and the URL can go.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
