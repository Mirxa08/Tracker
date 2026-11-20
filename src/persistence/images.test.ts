import { fitWithin, blobToDataUrl, dataUrlToBlob, imageObjectUrl, MAX_IMAGE_EDGE } from './images'
import { putImage } from './db'

test('fitWithin leaves a small image alone', () => {
  expect(fitWithin(300, 200, MAX_IMAGE_EDGE)).toEqual({ width: 300, height: 200 })
})

test('fitWithin scales a wide image by its long edge', () => {
  expect(fitWithin(1800, 900, 600)).toEqual({ width: 600, height: 300 })
})

test('fitWithin scales a tall image by its long edge', () => {
  expect(fitWithin(900, 1800, 600)).toEqual({ width: 300, height: 600 })
})

test('fitWithin never returns a zero dimension', () => {
  expect(fitWithin(6000, 3, 600).height).toBeGreaterThanOrEqual(1)
})

test('blobToDataUrl and dataUrlToBlob round-trip the bytes', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' })
  const dataUrl = await blobToDataUrl(blob)
  expect(dataUrl.startsWith('data:image/webp;base64,')).toBe(true)
  const back = await dataUrlToBlob(dataUrl)
  expect(back.size).toBe(blob.size)
  expect(back.type).toBe('image/webp')
})

test('imageObjectUrl returns null for a missing image', async () => {
  expect(await imageObjectUrl('img_missing')).toBeNull()
})

test('imageObjectUrl returns a url for a stored image', async () => {
  await putImage({
    id: 'img_present',
    blob: new Blob([new Uint8Array([9])], { type: 'image/webp' }),
    width: 10,
    height: 10,
  })
  expect(await imageObjectUrl('img_present')).toMatch(/^blob:/)
})
