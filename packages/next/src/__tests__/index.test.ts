import { describe, it, expect } from 'vitest'
import { sleekstackNext } from '../index'

describe('@sleekstack/next', () => {
  it('exports its entry point', () => {
    expect(sleekstackNext).toBe(true)
  })
})
