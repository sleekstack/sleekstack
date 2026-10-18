import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
/** Exported names in a source file whose declaration takes a slot at runtime. */
const slotHooks = (rel: string) =>
  read(rel)
    .split(/\n(?=export )/)
    .filter((chunk) => chunk.includes('takeSlot('))
    .map((chunk) => /^export (?:const|function) (\w+)/.exec(chunk)?.[1])

const MODEL = '../../../model/src/'

describe('slot hooks', () => {
  it('the analyzer checks exactly the hooks that take a slot at runtime, in ui and in @sleekstack/model', () => {
    const runtime = [
      ...slotHooks('../../../ui/src/reactive.ts'),
      ...readdirSync(new URL(MODEL, import.meta.url))
        .filter((f) => f.endsWith('.ts'))
        .flatMap((f) => slotHooks(MODEL + f)),
    ]
    const analyzed = [...read('../components.ts').matchAll(/'((?:ui\/reactive|model\/\w+)#\w+)'\) checkSlot/g)].map(
      (m) => m[1]!,
    )
    const declared = analyzed.filter((a) => !a.startsWith('model/record#')).map((a) => a.split('#')[1])
    expect(runtime).toContain('useDraft')
    expect(runtime).toContain('useRecord')
    expect(declared.sort()).toEqual(runtime.sort())
  })

  it('the analyzer checks every hook method of a record definition, which takes its slot through `useDraft`', () => {
    // A record method delegates to a slot hook, so it has no `takeSlot` call of its own for the case above to find.
    const methods = [...read(MODEL + 'record.ts').matchAll(/^ {2}readonly (use\w+):/gm)].map(
      (m) => `model/record#${m[1]}`,
    )
    const analyzed = [...read('../components.ts').matchAll(/'(model\/record#\w+)'\) checkSlot/g)].map((m) => m[1])
    expect(methods).toEqual(['model/record#useDraft'])
    expect(analyzed).toEqual(methods)
  })
})
