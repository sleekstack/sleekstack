import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

describe('slot hooks', () => {
  it('the analyzer checks exactly the hooks that take a slot at runtime', () => {
    const runtime = read('../../../ui/src/reactive.ts')
      .split(/\n(?=export )/)
      .filter((chunk) => chunk.includes('takeSlot('))
      .map((chunk) => /^export (?:const|function) (\w+)/.exec(chunk)?.[1])
    const analyzed = [...read('../components.ts').matchAll(/'ui\/reactive#(\w+)'\) checkSlot/g)].map((m) => m[1])
    expect(runtime.length).toBeGreaterThan(0)
    expect(analyzed.sort()).toEqual(runtime.sort())
  })
})
