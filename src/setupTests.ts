import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// fake-indexeddb clones values on write using the global structuredClone. Under jsdom,
// Blob is jsdom's class, which the structured-clone algorithm does not understand: it
// silently arrives as {}. Real IndexedDB stores Blobs natively, so keep Blobs by reference
// (recursing through plain objects and arrays, since records wrap the blob) to match that.
const nativeStructuredClone = globalThis.structuredClone
const cloneKeepingBlobs = (value: unknown): unknown => {
  if (value instanceof Blob) return value
  if (Array.isArray(value)) return value.map(cloneKeepingBlobs)
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneKeepingBlobs(v)]))
  }
  return nativeStructuredClone(value)
}
globalThis.structuredClone = cloneKeepingBlobs as typeof structuredClone

if (typeof URL.createObjectURL !== 'function') {
  let counter = 0
  URL.createObjectURL = () => `blob:tracker/${(counter += 1)}`
  URL.revokeObjectURL = () => {}
}

// jsdom has no PointerEvent, so fireEvent.pointerDown would build a plain Event and drop
// clientX / shiftKey / button. A MouseEvent subclass carries them, which is all drag needs.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}
