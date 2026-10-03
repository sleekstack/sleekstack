import { Cause, Data, Effect, Layer } from 'effect'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { el, fragment, fromReact, Provide, renderToString } from '../index'
import { app, UserCard, UserNotFound, UserRepoTest } from './fixtures/user-card'

class Boom extends Data.TaggedError('Boom')<{}> {}

describe('renderToString', () => {
  it('renders the UserCard example to exact markup', async () => {
    expect(await renderToString(app('1'), { layer: UserRepoTest })).toBe(
      '<div class="card"><h2>Ada</h2><span class="avatar">Ada</span></div>',
    )
    expect(await renderToString(app('2'), { layer: UserRepoTest })).toBe('<p>Not found</p>')
  })

  it('rejects an uncaught failure with the original error', async () => {
    const err = await renderToString(UserCard({ id: '2' }), { layer: UserRepoTest }).catch((e) => e)
    expect(err).toBeInstanceOf(UserNotFound)
  })

  it('rejects with the layer error and with defects', async () => {
    const boom = new Boom()
    await expect(renderToString(Effect.succeed(el('p')), { layer: Layer.fail(boom) })).rejects.toBe(boom)
    const defect = new Error('defect')
    await expect(renderToString(Effect.die(defect), { layer: Layer.empty })).rejects.toBe(defect)
  })

  it('Provide supplies a layer to its children', async () => {
    expect(await renderToString(Provide(UserRepoTest, app('1')), { layer: Layer.empty })).toContain('Ada')
  })

  it('renders a fromReact guest with its props inline', async () => {
    const Greet = fromReact(({ who }: { who: string }) => createElement('b', null, `hi ${who}`))
    const tree = Effect.map(Greet({ who: 'Bo' }), (g) => el('div', {}, g))
    expect(await renderToString(tree, { layer: Layer.empty })).toBe('<div><b>hi Bo</b></div>')
  })

  it('escapes text and attribute values', async () => {
    const tree = Effect.succeed(el('p', { title: `"'<script>` }, '<script>&"\''))
    expect(await renderToString(tree, { layer: Layer.empty })).toBe(
      '<p title="&quot;&#39;&lt;script&gt;">&lt;script&gt;&amp;&quot;&#39;</p>',
    )
  })

  it('a throwing guest renders as nothing and reports the cause', async () => {
    const Bad = fromReact((): never => {
      throw new Error('guest')
    })
    const tree = Effect.map(Bad({}), (b) => fragment('a', b, 'b'))
    const onError = vi.fn()
    expect(await renderToString(tree, { layer: Layer.empty, onError })).toBe('ab')
    expect(Cause.squash(onError.mock.calls[0]![0])).toMatchObject({ message: 'guest' })

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await renderToString(tree, { layer: Layer.empty })).toBe('ab')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
