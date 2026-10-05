import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { layer, module, tag, withCleanup } from '../index'
import { boot } from './helpers'

interface Config {
  url: string
}
const Config = tag<Config>('Config')
interface Conn {
  url: string
}
const Conn = tag<Conn>('Conn')
type Transform = (n: number) => number
const Transform = tag<Transform>('Transform')
const List = tag<number[]>('List')
const cfg = layer(Config, { url: 'x' })
const run = (...provide: Parameters<typeof module>[0]['provide'] & object) => boot(module({ name: 'App', provide }))

class ConnImpl implements Conn {
  url: string
  constructor(c: Config) {
    this.url = `class:${c.url}`
  }
}

describe('layer', () => {
  it.each([
    ['factory', layer(Conn, (c) => ({ url: `f:${c.url}` }), [Config]), 'f:x'],
    ['async factory', layer(Conn, async (c) => ({ url: `a:${c.url}` }), [Config]), 'a:x'],
    ['class', layer(Conn, ConnImpl, [Config]), 'class:x'],
    ['value', layer(Conn, { url: 'v' }), 'v'],
  ])('%s', async (_, l, url) => {
    expect((await run(cfg, l)).get<Conn>(Conn).url).toBe(url)
  })

  it('withCleanup: service returned, cleanup runs on scope close', async () => {
    const end = vi.fn()
    const { get, scope } = await run(
      cfg,
      layer(Conn, (c) => withCleanup({ url: c.url }, end), [Config]),
    )
    expect(get<Conn>(Conn).url).toBe('x')
    expect(end).not.toHaveBeenCalled()
    await Effect.runPromise(scope.close)
    expect(end).toHaveBeenCalledOnce()
  })

  it('a throwing cleanup reaches onFinalizerError', async () => {
    const sink = vi.fn()
    const { scope } = await boot(
      module({
        name: 'App',
        provide: [
          layer(Conn, () =>
            withCleanup({ url: '' }, () => {
              throw new Error('bye')
            }),
          ),
        ],
      }),
      sink,
    )
    scope.dispose()
    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce())
  })

  it('an array service is returned as-is', async () => {
    expect((await run(layer(List, () => [1, 2]))).get(List)).toEqual([1, 2])
  })

  it.each([
    [
      'sync throw',
      () => {
        throw new Error('nope')
      },
    ],
    [
      'reject',
      async () => {
        throw new Error('nope')
      },
    ],
  ])('factory %s -> LayerFailed naming the Tag', async (_, f) => {
    const e = await run(layer(Conn, f as never)).catch((x) => x)
    expect(e.code).toBe('LayerFailed')
    expect(e.details.tag).toBe('Conn')
    expect(e.message).toContain('Conn')
  })

  it('function impl is always a factory; () => fn yields the function', async () => {
    const asFactory = await run(layer(Transform, ((n: number) => n + 1) as never))
    expect(asFactory.get(Transform)).toBeNaN()
    const fn: Transform = (n) => n + 1
    expect((await run(layer(Transform, () => fn))).get<Transform>(Transform)(1)).toBe(2)
  })
})

describe('layer (generator factory)', () => {
  it('resolves yielded Tags from earlier entries; finalizers run in reverse build order', async () => {
    const log: string[] = []
    const conn = layer(Conn, function* () {
      const c = yield* Config
      log.push('build Conn')
      return withCleanup({ url: `g:${c.url}` }, () => {
        log.push('close Conn')
      })
    })
    const config = layer(Config, function* () {
      log.push('build Config')
      return withCleanup({ url: 'x' }, () => {
        log.push('close Config')
      })
    })
    const { get, scope } = await run(config, conn) // providers first: entries build in position order
    expect(get<Conn>(Conn).url).toBe('g:x')
    await Effect.runPromise(scope.close)
    expect(log).toEqual(['build Config', 'build Conn', 'close Conn', 'close Config'])
  })

  it('a provider yielded twice builds once and finalizes once', async () => {
    const end = vi.fn()
    const config = layer(Config, function* () {
      return withCleanup({ url: 'x' }, end)
    })
    const conn = layer(Conn, function* () {
      return { url: (yield* Config).url }
    })
    const list = layer(List, function* () {
      return [(yield* Config).url.length]
    })
    const { scope } = await run(config, conn, list)
    await Effect.runPromise(scope.close)
    expect(end).toHaveBeenCalledOnce()
  })

  it('an array-form layer can depend on a generator layer', async () => {
    const config = layer(Config, function* () {
      return { url: 'y' }
    })
    expect(
      (
        await run(
          config,
          layer(Conn, (c) => ({ url: c.url }), [Config]),
        )
      ).get<Conn>(Conn).url,
    ).toBe('y')
  })

  it('unprovided yield -> MissingDependency', async () => {
    const e = await run(
      layer(Conn, function* () {
        return { url: (yield* Config).url }
      }),
    ).catch((x) => x)
    expect(e.code).toBe('MissingDependency')
    expect(e.message).toContain('Config')
  })

  it("a Tag listed after its yielding layer -> MissingDependency (cycles are the analyzer's)", async () => {
    const a = layer(Config, function* () {
      return { url: (yield* Conn).url }
    })
    const b = layer(Conn, function* () {
      return { url: (yield* Config).url }
    })
    const e = await run(a, b).catch((x) => x)
    expect(e.code).toBe('MissingDependency')
  })

  it('a throwing generator -> LayerFailed', async () => {
    const e = await run(
      layer(Conn, function* () {
        throw new Error('nope')
      }),
    ).catch((x) => x)
    expect(e.code).toBe('LayerFailed')
  })
})
