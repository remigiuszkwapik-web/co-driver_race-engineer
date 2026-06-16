/**
 * Salsa20/20 stream cipher — just enough to decrypt Gran Turismo 7's telemetry
 * feed (Node's crypto has ChaCha20 but not raw Salsa20). A stream cipher is
 * symmetric: encrypt and decrypt are the same XOR-with-keystream operation, so
 * `salsa20()` serves both. Validated against the official eSTREAM 256-bit KAT
 * in test/unit/salsa20.test.ts.
 */

// "expand 32-byte k"
const SIGMA0 = 0x61707865
const SIGMA1 = 0x3320646e
const SIGMA2 = 0x79622d32
const SIGMA3 = 0x6b206574

const rotl = (a: number, b: number): number => ((a << b) | (a >>> (32 - b))) >>> 0

/**
 * Salsa20 hash: 20 rounds (10 column/row double-rounds) over the 16-word state,
 * each word added back at the end. Worked in local vars (kept unsigned via
 * `>>> 0`) so signed-int32 XOR results don't leak into the next addition.
 */
function core(out: Uint32Array, j: Uint32Array): void {
  let x0 = j[0]!
  let x1 = j[1]!
  let x2 = j[2]!
  let x3 = j[3]!
  let x4 = j[4]!
  let x5 = j[5]!
  let x6 = j[6]!
  let x7 = j[7]!
  let x8 = j[8]!
  let x9 = j[9]!
  let x10 = j[10]!
  let x11 = j[11]!
  let x12 = j[12]!
  let x13 = j[13]!
  let x14 = j[14]!
  let x15 = j[15]!

  for (let i = 0; i < 10; i++) {
    // column rounds
    x4 = (x4 ^ rotl((x0 + x12) >>> 0, 7)) >>> 0
    x8 = (x8 ^ rotl((x4 + x0) >>> 0, 9)) >>> 0
    x12 = (x12 ^ rotl((x8 + x4) >>> 0, 13)) >>> 0
    x0 = (x0 ^ rotl((x12 + x8) >>> 0, 18)) >>> 0
    x9 = (x9 ^ rotl((x5 + x1) >>> 0, 7)) >>> 0
    x13 = (x13 ^ rotl((x9 + x5) >>> 0, 9)) >>> 0
    x1 = (x1 ^ rotl((x13 + x9) >>> 0, 13)) >>> 0
    x5 = (x5 ^ rotl((x1 + x13) >>> 0, 18)) >>> 0
    x14 = (x14 ^ rotl((x10 + x6) >>> 0, 7)) >>> 0
    x2 = (x2 ^ rotl((x14 + x10) >>> 0, 9)) >>> 0
    x6 = (x6 ^ rotl((x2 + x14) >>> 0, 13)) >>> 0
    x10 = (x10 ^ rotl((x6 + x2) >>> 0, 18)) >>> 0
    x3 = (x3 ^ rotl((x15 + x11) >>> 0, 7)) >>> 0
    x7 = (x7 ^ rotl((x3 + x15) >>> 0, 9)) >>> 0
    x11 = (x11 ^ rotl((x7 + x3) >>> 0, 13)) >>> 0
    x15 = (x15 ^ rotl((x11 + x7) >>> 0, 18)) >>> 0
    // row rounds
    x1 = (x1 ^ rotl((x0 + x3) >>> 0, 7)) >>> 0
    x2 = (x2 ^ rotl((x1 + x0) >>> 0, 9)) >>> 0
    x3 = (x3 ^ rotl((x2 + x1) >>> 0, 13)) >>> 0
    x0 = (x0 ^ rotl((x3 + x2) >>> 0, 18)) >>> 0
    x6 = (x6 ^ rotl((x5 + x4) >>> 0, 7)) >>> 0
    x7 = (x7 ^ rotl((x6 + x5) >>> 0, 9)) >>> 0
    x4 = (x4 ^ rotl((x7 + x6) >>> 0, 13)) >>> 0
    x5 = (x5 ^ rotl((x4 + x7) >>> 0, 18)) >>> 0
    x11 = (x11 ^ rotl((x10 + x9) >>> 0, 7)) >>> 0
    x8 = (x8 ^ rotl((x11 + x10) >>> 0, 9)) >>> 0
    x9 = (x9 ^ rotl((x8 + x11) >>> 0, 13)) >>> 0
    x10 = (x10 ^ rotl((x9 + x8) >>> 0, 18)) >>> 0
    x12 = (x12 ^ rotl((x15 + x14) >>> 0, 7)) >>> 0
    x13 = (x13 ^ rotl((x12 + x15) >>> 0, 9)) >>> 0
    x14 = (x14 ^ rotl((x13 + x12) >>> 0, 13)) >>> 0
    x15 = (x15 ^ rotl((x14 + x13) >>> 0, 18)) >>> 0
  }

  out[0] = (x0 + j[0]!) >>> 0
  out[1] = (x1 + j[1]!) >>> 0
  out[2] = (x2 + j[2]!) >>> 0
  out[3] = (x3 + j[3]!) >>> 0
  out[4] = (x4 + j[4]!) >>> 0
  out[5] = (x5 + j[5]!) >>> 0
  out[6] = (x6 + j[6]!) >>> 0
  out[7] = (x7 + j[7]!) >>> 0
  out[8] = (x8 + j[8]!) >>> 0
  out[9] = (x9 + j[9]!) >>> 0
  out[10] = (x10 + j[10]!) >>> 0
  out[11] = (x11 + j[11]!) >>> 0
  out[12] = (x12 + j[12]!) >>> 0
  out[13] = (x13 + j[13]!) >>> 0
  out[14] = (x14 + j[14]!) >>> 0
  out[15] = (x15 + j[15]!) >>> 0
}

/**
 * XOR `data` with the Salsa20 keystream for (`key`, `nonce`). `key` must be 32
 * bytes, `nonce` 8 bytes. Returns a new Buffer the same length as `data`.
 */
export function salsa20(key: Buffer, nonce: Buffer, data: Buffer): Buffer {
  const s = new Uint32Array(16)
  s[0] = SIGMA0
  s[5] = SIGMA1
  s[10] = SIGMA2
  s[15] = SIGMA3
  s[1] = key.readUInt32LE(0)
  s[2] = key.readUInt32LE(4)
  s[3] = key.readUInt32LE(8)
  s[4] = key.readUInt32LE(12)
  s[11] = key.readUInt32LE(16)
  s[12] = key.readUInt32LE(20)
  s[13] = key.readUInt32LE(24)
  s[14] = key.readUInt32LE(28)
  s[6] = nonce.readUInt32LE(0)
  s[7] = nonce.readUInt32LE(4)

  const out = Buffer.alloc(data.length)
  const block = new Uint32Array(16)
  const ks = Buffer.alloc(64)
  let cLo = 0
  let cHi = 0
  for (let off = 0; off < data.length; off += 64) {
    s[8] = cLo // 64-bit block counter
    s[9] = cHi
    core(block, s)
    for (let i = 0; i < 16; i++) ks.writeUInt32LE(block[i]!, i * 4)
    const n = Math.min(64, data.length - off)
    for (let i = 0; i < n; i++) out[off + i] = data[off + i]! ^ ks[i]!
    cLo = (cLo + 1) >>> 0
    if (cLo === 0) cHi = (cHi + 1) >>> 0 // carry
  }
  return out
}
