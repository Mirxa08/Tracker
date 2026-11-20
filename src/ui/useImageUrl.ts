import { useEffect, useState } from 'react'
import { imageObjectUrl } from '../persistence/images'

/**
 * Resolves a stored image to an object URL, revoking it on unmount so the
 * blob is released. Returns null while loading and when the image is missing,
 * which is expected after a structure-only import.
 */
export function useImageUrl(imageId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!imageId) {
      setUrl(null)
      return
    }
    let created: string | null = null
    let cancelled = false
    imageObjectUrl(imageId)
      .then((value) => {
        if (cancelled) {
          if (value) URL.revokeObjectURL(value)
          return
        }
        created = value
        setUrl(value)
      })
      .catch(() => setUrl(null))
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [imageId])
  return url
}
