import { useEffect, useState } from 'react'
import { imageObjectUrl } from '../persistence/images'

/**
 * Resolves a stored image to an object URL, revoking it on unmount so the
 * blob is released. Returns null while loading and when the image is missing,
 * which is expected after a structure-only import.
 *
 * The resolved URL is keyed to the id it was resolved for: when the id changes the old
 * URL is revoked by the effect cleanup, and must never be handed back for the new id.
 */
export function useImageUrl(imageId: string | undefined): string | null {
  const [resolved, setResolved] = useState<{ id: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!imageId) return
    let created: string | null = null
    let cancelled = false
    imageObjectUrl(imageId)
      .then((value) => {
        if (cancelled) {
          if (value) URL.revokeObjectURL(value)
          return
        }
        created = value
        setResolved({ id: imageId, url: value })
      })
      .catch(() => setResolved({ id: imageId, url: null }))
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [imageId])
  return imageId && resolved?.id === imageId ? resolved.url : null
}
