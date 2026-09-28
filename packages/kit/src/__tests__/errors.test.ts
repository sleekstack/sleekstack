import { describe, expect, it } from 'vitest'
import { layer, module, snapshot, tag, SleekStackError } from '../index'
import { err } from './helpers'

const A = tag<string>('A')
const B = tag<string>('B')
const lib = (name: string) => module({ name, provide: [layer(A, () => name)] })

const cycleA: { m?: ReturnType<typeof module> } = {}
const ModA = module({ name: 'ModA', imports: () => [cycleA.m!] })
cycleA.m = module({ name: 'ModB', imports: [ModA] })

describe('core graph errors via the kit API', () => {
  it.each([
    ['MissingDependency', () => snapshot(module({ name: 'App', provide: [layer(B, (x) => x, [A])] })), { service: 'B', missing: 'A', module: 'App' }],
    ['DependencyCycle', () => snapshot(module({ name: 'App', provide: [layer(A, (x) => x, [B]), layer(B, (x) => x, [A])] })), { path: ['A', 'B', 'A'] }],
    ['AmbiguousProvider', () => snapshot(module({ name: 'App', imports: [lib('L1'), lib('L2')] })), { tag: 'A', modules: ['L1', 'L2'] }],
    ['ModuleCycle', () => snapshot(ModA), {}],
    ['DuplicateModule', () => snapshot(module({ name: 'App', imports: [lib('X'), module({ name: 'Y', imports: [lib('X')] })] })), { name: 'X' }],
    ['InvalidModule', () => module({ name: '' }), {}],
    ['InvalidModule', () => module({} as never), {}],
    ['CaptiveDependency', () => snapshot(module({ name: 'App', provide: [layer(A, () => 'r', [], { lifetime: 'request' }), layer(B, (x) => x, [A])] })), { service: 'B', dependency: 'A' }],
  ])('%s', (code, f, details) => {
    const e = err(f)
    expect(e).toBeInstanceOf(SleekStackError)
    expect(e.code).toBe(code)
    expect(e.message.length).toBeGreaterThan(0)
    expect(e.details).toMatchObject(details)
  })
})
