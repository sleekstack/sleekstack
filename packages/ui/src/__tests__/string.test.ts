import { Cause, Context, Data, Effect, Layer } from 'effect'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { el, fragment, fromReact, type Node, Pending, Provide, renderToString } from '../index'
import { jsx } from '../jsx-runtime'
import { app, UserCard, UserNotFound, UserRepoTest } from './fixtures/user-card'

class Boom extends Data.TaggedError('Boom')<{}> {}

describe('renderToString', () => {
  it('renders the UserCard example to exact markup', async () => {
    expect(await renderToString(app('1'), { layer: UserRepoTest })).toBe(
      '<div class="card"><h2>Ada</h2><sleek-guest style="display: contents;"><span class="avatar">Ada</span></sleek-guest></div>',
    )
    expect(await renderToString(app('2'), { layer: UserRepoTest })).toBe('<p>Not found</p>')
  })

  it('separates adjacent text, also across fragments, with a comment marker', async () => {
    const html = await renderToString(Effect.succeed(el('p', {}, 'a', fragment('b', el('i')), 'c')), { layer: Layer.empty })
    expect(html).toBe('<p>a<!--sleek-t-->b<i></i>c</p>')
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
    expect(await renderToString(tree, { layer: Layer.empty })).toBe('<div><sleek-guest style="display: contents;"><b>hi Bo</b></sleek-guest></div>')
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
  it.each([
    ['tag', el('img src=x onerror=alert(1)')],
    ['attribute', el('p', { 'x="y" onmouseover': 'z' })],
    ['direct node', { _tag: 'Element', tag: 'p><script', attrs: {}, children: [] } as Node],
  ])('rejects a hostile %s name', async (_, node) => {
    await expect(renderToString(Effect.succeed(node), { layer: Layer.empty })).rejects.toThrow(TypeError)
  })

  it('a throwing onError never changes the outcome', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = () => {
      throw new Error('sink')
    }
    const err = await renderToString(UserCard({ id: '2' }), { layer: UserRepoTest, onError }).catch((e) => e)
    expect(err).toBeInstanceOf(UserNotFound)
    const Bad = fromReact((): never => {
      throw new Error('guest')
    })
    const tree = Effect.map(Bad({}), (b) => fragment('a', b))
    expect(await renderToString(tree, { layer: Layer.empty, onError })).toBe('a')
    spy.mockRestore()
  })

  describe('JSX events and keys', () => {
    class Tag extends Context.Tag('Tag')<Tag, string>() {}
    const run = () => Effect.void

    it('diverts a function onClick into events with the captured context, never an attribute', async () => {
      const node = (await Effect.runPromise(Effect.provideService(jsx('button', { onClick: run, children: 'go' }), Tag, 't'))) as any
      expect(node.attrs).toEqual({})
      expect(node.events.click.run).toBe(run)
      expect(Context.get(node.events.click.context, Tag)).toBe('t')
    })

    it('still rejects a non-function on* prop', async () => {
      await expect(renderToString(jsx('a', { onClick: 'x()' }), { layer: Layer.empty })).rejects.toThrow('Unsafe attribute')
    })

    it('carries key on elements, not attrs; unkeyed nodes have no key', async () => {
      expect(await Effect.runPromise(jsx('p', { id: 'a' }, 'k1'))).toEqual({ ...el('p', { id: 'a' }), key: 'k1' })
      expect(await Effect.runPromise(jsx('p', {}))).toEqual(el('p'))
    })

    it('renderToString ignores events, key and id', async () => {
      const tree = jsx('ul', { children: [jsx('li', { onClick: run, children: 'a' }, 'x')] })
      expect(await renderToString(Effect.map(tree, (n) => ({ ...n, id: 'i' }) as any), { layer: Layer.empty })).toBe('<ul><li>a</li></ul>')
    })
  })

  it('Pending awaits its content and emits no fallback markup', async () => {
    const Slow = () => Effect.as(Effect.sleep('5 millis'), el('p', {}, 'loaded'))
    const tree = jsx(Pending, { fallback: el('i', {}, 'wait'), children: jsx(Slow, {}) })
    expect(await renderToString(tree, { layer: Layer.empty })).toBe('<p>loaded</p>')
  })

  it('a failing Pending child rejects with its typed error', async () => {
    const boom = new Boom()
    const tree = jsx(Pending, { fallback: el('i', {}, 'wait'), children: Effect.fail(boom) })
    await expect(renderToString(tree, { layer: Layer.empty })).rejects.toBe(boom)
  })
})
