import { describe, expect, it } from 'vitest'
import { Cause, Effect } from 'effect'
import { MissingDependency } from '@sleekstack/core'
import { CleanupFailure, LayerFailure, normalize } from '../errors'
import { module, SleekStackError } from '../index'
import { err } from './helpers'

// The build-time graph errors are the analyzer's (packages/analyze fixtures); their runtime
// normalization is covered by `normalize envelopes` below.
describe('definition-time errors via the kit API', () => {
  it.each([
    ['InvalidModule', () => module({ name: '' }), {}],
    ['InvalidModule', () => module({} as never), {}],
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
    ['plain Error with a Cause cause is not unwrapped', new Error('pretty', { cause: Cause.fail(graph) }), 'Unknown', {}],
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

it('the exported constructor keeps its runtime name', () => {
  expect(SleekStackError.name).toBe('SleekStackError')
  expect(new SleekStackError('Unknown', 'm').constructor.name).toBe('SleekStackError')
})
