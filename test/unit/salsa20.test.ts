import { describe, expect, it } from 'vitest'
import { salsa20 } from '../../server/adapters/salsa20'

describe('salsa20', () => {
  // Official eSTREAM Salsa20/20 256-bit known-answer test, Set 1 vector 0:
  // key = 0x80 followed by zeros, IV = 0, keystream[0..63] is fixed.
  it('matches the eSTREAM 256-bit KAT (Set 1, vector 0)', () => {
    const key = Buffer.alloc(32)
    key[0] = 0x80
    const nonce = Buffer.alloc(8)
    const keystream = salsa20(key, nonce, Buffer.alloc(64)) // XOR with zeros = raw keystream
    const expected = [
      'E3BE8FDD8BECA2E3EA8EF9475B29A6E7003951E1097A5C38D23B7A5FAD9F6844',
      'B22C97559E2723C7CBBD3FE4FC8D9A0744652A83E72A9C461876AF4D7EF1A117'
    ].join('')
    expect(keystream.toString('hex').toUpperCase()).toBe(expected)
  })

  it('is symmetric: decrypt(encrypt(x)) === x', () => {
    const key = Buffer.from('Simulator Interface Packet GT7 v', 'ascii') // 32 bytes
    const nonce = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
    const plain = Buffer.from('the quick brown fox jumps over the lazy dog, twice over!!', 'ascii')
    const enc = salsa20(key, nonce, plain)
    expect(enc.equals(plain)).toBe(false)
    const dec = salsa20(key, nonce, enc)
    expect(dec.equals(plain)).toBe(true)
  })

  it('spans multiple 64-byte blocks correctly', () => {
    const key = Buffer.alloc(32, 7)
    const nonce = Buffer.alloc(8, 3)
    const plain = Buffer.alloc(200, 0xab) // > 3 blocks
    const round = salsa20(key, nonce, salsa20(key, nonce, plain))
    expect(round.equals(plain)).toBe(true)
  })
})
