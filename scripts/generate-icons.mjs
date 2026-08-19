import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const publicDir = join(scriptDir, '..', 'public')

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const background = [127, 63, 83]
  const glow = [232, 174, 157]
  const ink = [255, 246, 238]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4
      const dx = (x - size * 0.36) / size
      const dy = (y - size * 0.28) / size
      const halo = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 0.62)
      pixels[index] = Math.round(background[0] + halo * 20)
      pixels[index + 1] = Math.round(background[1] + halo * 12)
      pixels[index + 2] = Math.round(background[2] + halo * 10)
      pixels[index + 3] = 255
    }
  }

  const paintCircle = (cx, cy, radius, color, alpha = 1) => {
    const minX = Math.max(0, Math.floor(cx - radius))
    const maxX = Math.min(size - 1, Math.ceil(cx + radius))
    const minY = Math.max(0, Math.floor(cy - radius))
    const maxY = Math.min(size - 1, Math.ceil(cy + radius))
    const radiusSquared = radius * radius

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = (x - cx) ** 2 + (y - cy) ** 2
        if (distance > radiusSquared) continue
        const index = (y * size + x) * 4
        pixels[index] = Math.round(pixels[index] * (1 - alpha) + color[0] * alpha)
        pixels[index + 1] = Math.round(pixels[index + 1] * (1 - alpha) + color[1] * alpha)
        pixels[index + 2] = Math.round(pixels[index + 2] * (1 - alpha) + color[2] * alpha)
      }
    }
  }

  paintCircle(size * 0.73, size * 0.25, size * 0.055, glow, 0.92)

  const points = 900
  for (let point = 0; point < points; point += 1) {
    const t = (point / points) * Math.PI * 2
    const denominator = 1 + Math.sin(t) ** 2
    const x = size * 0.5 + (size * 0.33 * Math.cos(t)) / denominator
    const y = size * 0.54 + (size * 0.31 * Math.sin(t) * Math.cos(t)) / denominator
    paintCircle(x, y, size * 0.035, ink)
  }

  const scanlineLength = size * 4 + 1
  const raw = Buffer.alloc(scanlineLength * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * scanlineLength] = 0
    pixels.copy(raw, y * scanlineLength + 1, y * size * 4, (y + 1) * size * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(publicDir, name), drawIcon(size))
}

console.log('PWA icons generated.')

