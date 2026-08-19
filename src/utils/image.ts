export async function compressImage(file: File, maxDimension = 960, quality = 0.72): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.size > 12 * 1024 * 1024) throw new Error('图片太大了，请选择 12MB 以内的照片。')

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('这张照片无法读取，请换一张试试。'))
    })
    image.src = objectUrl
    await loaded

    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器暂时无法处理这张照片。')
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

