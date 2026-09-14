/** Downscale + re-encode an image client-side before it ever hits the network —
 * a 12MB phone photo becomes a ~100KB upload instead. The server re-compresses
 * on arrival too, so this is an optimization, not the only safety net. */
export async function compressImageFile(file: File, maxDimension = 512, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas is not supported in this browser")
    ctx.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image compression failed"))), "image/jpeg", quality)
    })
  } finally {
    bitmap.close()
  }
}
