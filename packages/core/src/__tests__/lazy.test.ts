import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { lazy } from '../lazy'

describe('lazy', () => {
  it('concurrent gets build once; a failed build retries on the next get', async () => {
    let builds = 0
    let fail = true
    const get = lazy<string, number>((k) => k, () =>
      Effect.suspend(() => (builds++, Effect.sleep(5))).pipe(Effect.flatMap(() => (fail ? Effect.fail('boom') : Effect.succeed(builds)))))
    const first = await Effect.runPromise(Effect.either(Effect.all([get('a'), get('a')], { concurrency: 'unbounded' })))
    expect(first._tag).toBe('Left')
    expect(builds).toBe(1)
    fail = false
    expect(await Effect.runPromise(Effect.all([get('a'), get('a')], { concurrency: 'unbounded' }))).toEqual([2, 2])
    expect(await Effect.runPromise(get('a'))).toBe(2)
    expect(builds).toBe(2)
  })

  it('re-entering a key on the chain fails with DependencyCycle', async () => {
    const get: (k: string, chain?: readonly string[]) => Effect.Effect<number, unknown> = lazy((k) => k, (k, chain) => get(k === 'a' ? 'b' : 'a', chain))
    const e = await Effect.runPromise(Effect.flip(get('a')))
    expect(e).toMatchObject({ _tag: 'DependencyCycle', path: ['a', 'b', 'a'] })
  })
})
