/**
 * Deterministic seeded pseudo-randomness.
 *
 * Used so demo / synthetic dashboard values stay STABLE across refreshes.
 * The same seed string always produces the same sequence — never use
 * Math.random() for visible dashboard numbers.
 */

/** FNV-1a 32-bit string hash → unsigned int seed. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 PRNG — small, fast, deterministic. Returns a generator in [0,1). */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Single deterministic float in [0,1) for a string seed. */
export function seededRandom(seed: string): number {
  return mulberry32(hashSeed(seed))()
}

/** Stateful deterministic generator for a seed string. */
export class SeededRng {
  private next: () => number

  constructor(seed: string) {
    this.next = mulberry32(hashSeed(seed))
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next()
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** Deterministic pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
}
