import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const S = 512
const px = Buffer.alloc(S * S * 4)

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const smooth = (d) => clamp(0.5 - d, 0, 1)

function roundedRectCoverage(x, y, r, rad) {
  const cx = clamp(x, r, S - r)
  const cy = clamp(y, r, S - r)
  const dx = x - cx
  const dy = y - cy
  const d = Math.hypot(dx, dy) - rad
  return smooth(d)
}

function distToSegment(px_, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = clamp(((px_ - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1)
  return Math.hypot(px_ - (x1 + t * dx), py - (y1 + t * dy))
}

const cx = S / 2
const cy = S / 2

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    const cover = roundedRectCoverage(x + 0.5, y + 0.5, 72, S / 2 - 3)

    // background gradient
    let r = lerp(67, 67, 0)
    let g = lerp(56, 56, 0)
    let b = lerp(202, 202, 0)
    const t = (y / S) * 0.35
    r = lerp(79, 67, t)
    g = lerp(70, 56, t)
    b = lerp(229, 202, t)

    // clock ring
    const ringD = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - 150)
    const ring = smooth(ringD - 14)

    // hands
    const hx = cx + (x + 0.5 - cx)
    const hy = cy + (y + 0.5 - cy)
    const minute = distToSegment(x + 0.5, y + 0.5, cx, cy, cx, cy - 118)
    const hour = distToSegment(x + 0.5, y + 0.5, cx, cy, cx + 86, cy + 62)
    const hand = smooth(Math.min(minute, hour) - 13)

    // center dot
    const dotD = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
    const dot = smooth(dotD - 26)

    const white = clamp(Math.max(ring, hand, dot), 0, 1) * cover
    px[i] = Math.round(lerp(r, 255, white))
    px[i + 1] = Math.round(lerp(g, 255, white))
    px[i + 2] = Math.round(lerp(b, 255, white))
    px[i + 3] = Math.round(255 * cover)
  }
}

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const raw = Buffer.alloc(S * (S * 4 + 1))
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = join(dirname(fileURLToPath(import.meta.url)), '../build/icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log('written', out, png.length, 'bytes')