import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { effect, layer, module, tag } from '../index'
import { toFinalizerError } from '../errors'
import { boot } from './helpers'

interface Log {
  lines: string[]
}
const Log = tag<Log>('Log')
const log = () => layer(Log, () => ({ lines: [] }))

describe('effect', () => {
  it('runs with typed deps when the scope opens; the returned function runs on close', async () => {
    const lg = log()
    const app = module({
      name: 'App',
      provide: [
        lg,
        effect(
          (l) => {
            l.lines.push('start')
            return () => void l.lines.push('stop')
          },
          [Log],
          { name: 'job' },
        ),
      ],
    })
    const { get, scope } = await boot(app)
    expect(get<Log>(Log).lines).toEqual(['start'])
    await Effect.runPromise(scope.close)
    expect(get<Log>(Log).lines).toEqual(['start', 'stop'])
  })

  it('async setup and no teardown are fine', async () => {
    const fn = vi.fn(async () => {})
    await boot(module({ name: 'App', provide: [effect(fn)] }))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('a setup throw is LayerFailed naming the effect', async () => {
    const e = await boot(
      module({
        name: 'App',
        provide: [
          effect(
            () => {
              throw new Error('nope')
            },
            [],
            { name: 'warmup' },
          ),
        ],
      }),
    ).catch((x) => x)
    expect(e).toMatchObject({ code: 'LayerFailed', details: { tag: 'effect:warmup' } })
  })

  it('a cleanup throw reaches onFinalizerError with the effect as tag', async () => {
    const sink = vi.fn()
    const { scope } = await boot(
      module({
        name: 'App',
        provide: [
          effect(
            () => () => {
              throw new Error('bye')
            },
            [],
            { name: 'sub' },
          ),
        ],
      }),
      sink,
    )
    scope.dispose()
    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce())
    expect(toFinalizerError(sink.mock.calls[0]![0])).toEqual({ message: 'bye', tag: 'effect:sub' })
  })
})
