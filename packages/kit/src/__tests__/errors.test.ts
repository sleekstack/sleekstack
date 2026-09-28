import { describe, expect, it } from 'vitest'
import { Cause, Effect } from 'effect'
import { MissingDependency } from '@sleekstack/core'
import { CleanupFailure, LayerFailure, normalize } from '../errors'
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

const graph = new MissingDependency({ service: 'S', missing: 'M', message: 'S needs M' })
const fiberFailure = (() => { try { Effect.runSync(Effect.fail(graph)) } catch (e) { return e } })()

describe('normalize envelopes', () => {
  it.each([
    ['Cause', Cause.fail(graph), 'MissingDependency', { service: 'S', missing: 'M' }],
    ['FiberFailure', fiberFailure, 'MissingDependency', { service: 'S', missing: 'M' }],
    ['next-wrapped rejection', new Error('pretty', { cause: Cause.fail(graph) }), 'MissingDependency', { service: 'S', missing: 'M' }],
    ['tagged graph error', graph, 'MissingDependency', { service: 'S', missing: 'M' }],
    ['LayerFailure', new LayerFailure('L', new Error('boom')), 'LayerFailed', { tag: 'L', cause: 'boom' }],
    ['CleanupFailure', new CleanupFailure('C', new Error('bye')), 'CleanupFailed', { tag: 'C' }],
    ['LayerFailure wrapping a Cause', new LayerFailure('L', Cause.fail(graph)), 'LayerFailed', { tag: 'L' }],
    ['CleanupFailure wrapping a Cause', new CleanupFailure('C', Cause.fail(graph)), 'CleanupFailed', { tag: 'C' }],
    ['plain Error with a non-Cause cause', new Error('x', { cause: 1 }), 'Unknown', {}],
  ])('%s', (_, input, code, details) => {
    const e = normalize(input)
    expect(e).toBeInstanceOf(SleekStackError)
    expect(e).toMatchObject({ code, details })
  })
})
