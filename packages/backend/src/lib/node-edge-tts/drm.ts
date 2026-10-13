import { createHash } from 'node:crypto'

export const CHROMIUM_FULL_VERSION = '143.0.3650.75'
export const CHROMIUM_MAJOR_VERSION = '143'
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'

const WIN_EPOCH = 11644473600
const PATENT_PREFIX = Buffer.from('Copyright (C) Microsoft Corporation. All rights reserved.', 'ascii')

function rol16(v: number): number {
  v = v >>> 0
  return ((v << 16) | (v >>> 16)) >>> 0
}

function wordsLe4Even(buf: Buffer): number[] {
  const padLen = (4 - (buf.length % 4)) % 4
  const padded = padLen > 0 ? Buffer.concat([buf, Buffer.alloc(padLen)]) : buf
  const words: number[] = []
  for (let i = 0; i < padded.length; i += 4) {
    words.push(padded.readUInt32LE(i))
  }
  if (words.length % 2 !== 0) {
    words.push(0)
  }
  return words
}

function cs64WordSwap(words: number[], keyWords: number[]): [number, number] {
  const a = (keyWords[0] | 1) >>> 0
  const b = (keyWords[1] | 1) >>> 0
  let acc = 0
  let last = 0
  for (let i = 0; i < words.length; i += 2) {
    const x = words[i]
    const y = words[i + 1]

    let t = (Math.imul(rol16(x), 0xEF0569FB) + Math.imul(x, a)) >>> 0
    t = rol16(t)
    let q = Math.imul(t, 0x76F50F34) >>> 0
    q = (Math.imul(rol16(q), 0xC3EFEA97) + q) >>> 0
    acc = (acc + q) >>> 0

    t = (Math.imul(rol16(y), 0xC31713DB) + Math.imul(y, b)) >>> 0
    t = rol16(t)
    q = Math.imul(t, 0x1881CE3C) >>> 0
    last = (Math.imul(rol16(q), 0x35BD1EC9) + q) >>> 0
    acc = (acc + last) >>> 0
  }
  return [last, acc]
}

function cs64Reversible(words: number[], keyWords: number[]): [number, number] {
  const a = (keyWords[0] | 1) >>> 0
  const b = (keyWords[1] | 1) >>> 0
  let state = 0
  let acc = 0
  const consts = [0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83]
  for (let i = 0; i < words.length; i += 2) {
    const x = words[i]
    const y = words[i + 1]

    state = Math.imul((state + x) >>> 0, a) >>> 0
    for (const c of consts) {
      state = Math.imul(rol16(state), c) >>> 0
    }
    let t = Math.imul((y + state) >>> 0, b) >>> 0
    t = Math.imul(rol16(t), 0xA27416F5) >>> 0
    t = Math.imul(rol16(t), 0xD38396FF) >>> 0
    t = rol16(t)
    acc = (acc + state) >>> 0
    state = Math.imul(rol16(Math.imul(t, 0x7C932B89) >>> 0), 0xBFA49F69) >>> 0
    acc = (acc + state) >>> 0
  }
  return [state, acc]
}

function patentHash(data: Buffer): string {
  const digest = createHash('sha256').update(data).digest()
  const dataWords = wordsLe4Even(data)
  const digestWords = wordsLe4Even(digest)
  const a = cs64WordSwap(dataWords, digestWords)
  const b = cs64Reversible(dataWords, digestWords)
  const buf = Buffer.alloc(8)
  buf.writeUInt32LE((a[0] ^ b[0]) >>> 0, 0)
  buf.writeUInt32LE((a[1] ^ b[1]) >>> 0, 4)
  const cs64 = buf.toString('hex').toUpperCase()
  const sha256 = digest.toString('hex').toUpperCase()
  return `${cs64}-${sha256}`
}

export function generateSecMsGecToken(unixTimestamp?: number): string {
  let ticks = unixTimestamp !== undefined ? Number(unixTimestamp) : Date.now() / 1000
  ticks += WIN_EPOCH
  ticks -= ticks % 300
  ticks *= 1e7
  const strToHash = Buffer.from(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, 'ascii')
  return patentHash(Buffer.concat([PATENT_PREFIX, strToHash]))
}

