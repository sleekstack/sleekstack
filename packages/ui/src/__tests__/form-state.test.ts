// @vitest-environment jsdom
import { Atom, makeAtomStore, Result } from '@sleekstack/core'
import { Cause, Deferred, Effect, Layer, Option, ParseResult, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { type ActionEvent, mount, type Mounted, useAction, useAtomValue, useFormStatus, useOptimistic } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

let mounts: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of mounts) await h.dispose()
  })
  mounts = []
  document.body.replaceChildren()
})

const go = async (app: any) => {
  const container = document.createElement('div')
  document.body.append(container)
  const store = makeAtomStore()
  const onError = vi.fn()
  await act(async () => void mounts.push(await mount(app, { layer: Layer.empty, container, store, onError })))
  const submit = () => act(() => container.querySelector('form')!.requestSubmit())
  return { container, store, onError, submit }
}

// A form whose action is `run`; it renders its status and the result's tag into `<output>`.
const form = <A, E>(run: (e: ActionEvent) => Effect.Effect<A, E>, seen: Array<Result.Result<A, E>>) =>
  function* () {
    const [result, action] = yield* useAction(run)
    const { pending } = yield* useFormStatus(result)
    const r = yield* useAtomValue(result)
    seen.push(r)
    return jsx('form', {
      action,
      children: [jsx('input', { name: 'n', value: 'x' }), jsx('output', { children: `${r._tag}:${pending}` })],
    })
  }

describe('useAction / useFormStatus', () => {
  it('pending while running, then settles to Success; the last value is kept while waiting', async () => {
    const gate = Effect.runSync(Deferred.make<void>())
    let n = 0
    const seen: Array<Result.Result<number>> = []
    const { container, submit } = await go(
      jsx(
        form(() => Effect.as(++n === 1 ? Effect.void : Deferred.await(gate), n), seen),
        {},
      ),
    )
    const out = () => container.querySelector('output')!.textContent
    expect(out()).toBe('Initial:false')
    await submit()
    await flush()
    expect(out()).toBe('Success:false')
    await submit()
    await flush()
    expect(out()).toBe('Success:true')
    expect(seen.at(-1)).toMatchObject({ _tag: 'Success', value: 1, waiting: true })
    await act(() => Effect.runPromise(Deferred.succeed(gate, undefined)))
    await flush()
    expect(seen.at(-1)).toMatchObject({ _tag: 'Success', value: 2, waiting: false })
  })

  it('a failure lands in the Result with the previous value, not in onError', async () => {
    const seen: Array<Result.Result<never, string>> = []
    const { container, onError, submit } = await go(
      jsx(
        form(() => Effect.fail('nope'), seen),
        {},
      ),
    )
    await submit()
    await flush()
    const r = seen.at(-1)!
    expect(Result.isFailure(r) && Cause.failureOption(r.cause)).toEqual(Option.some('nope'))
    expect(container.querySelector('output')!.textContent).toBe('Failure:false')
    expect(onError).not.toHaveBeenCalled()
  })

  it('a Schema decode failure of formData is a typed ParseError failure', async () => {
    const Input = Schema.Struct({ n: Schema.NumberFromString })
    const seen: Array<Result.Result<unknown, ParseResult.ParseError>> = []
    await go(
      jsx(
        form((e) => Schema.decodeUnknown(Input)(Object.fromEntries(e.formData)), seen),
        {},
      ),
    ).then((m) => m.submit())
    await flush()
    const r = seen.at(-1)!
    expect(Result.isFailure(r) && Option.getOrThrow(Cause.failureOption(r.cause))).toBeInstanceOf(
      ParseResult.ParseError,
    )
  })
})

describe('useOptimistic', () => {
  it('shows the change while the action runs; on failure reverts before the Result records it', async () => {
    const source = Atom.make<ReadonlyArray<string>>(['a'])
    const gate = Effect.runSync(Deferred.make<void, string>())
    const atFailure: Array<unknown> = []
    let view!: Atom.Atom<ReadonlyArray<string>>
    let result!: Atom.Atom<Result.Result<void, string>>
    const C = function* () {
      const [list, optimistic] = yield* useOptimistic(source, (l: ReadonlyArray<string>, add: string) => [...l, add])
      const [r, action] = yield* useAction((e: ActionEvent) =>
        optimistic(String(e.formData.get('n')), Deferred.await(gate)),
      )
      view = list
      result = r
      const items = yield* useAtomValue(list)
      return jsx('form', {
        action,
        children: [jsx('input', { name: 'n', value: 'b' }), jsx('ul', { children: items.join(',') })],
      })
    }
    const { container, store, submit } = await go(jsx(C, {}))
    store.subscribe(result, () => {
      if (Result.isFailure(store.get(result))) atFailure.push(store.get(view))
    })
    expect(container.querySelector('ul')!.textContent).toBe('a')
    await submit()
    await flush()
    expect(container.querySelector('ul')!.textContent).toBe('a,b')
    await act(() => Effect.runPromise(Deferred.fail(gate, 'x')))
    await flush()
    expect(container.querySelector('ul')!.textContent).toBe('a')
    expect(atFailure).toEqual([['a']])
  })

  it('reverts to the source when the action settles successfully', async () => {
    const source = Atom.make(1)
    const gate = Effect.runSync(Deferred.make<void>())
    const C = function* () {
      const [n, optimistic] = yield* useOptimistic(source, (a: number, d: number) => a + d)
      const [, action] = yield* useAction(() => optimistic(10, Deferred.await(gate)))
      const v = yield* useAtomValue(n)
      return jsx('form', { action, children: String(v) })
    }
    const { container, submit } = await go(jsx(C, {}))
    await submit()
    await flush()
    expect(container.textContent).toBe('11')
    await act(() => Effect.runPromise(Deferred.succeed(gate, undefined)))
    await flush()
    expect(container.textContent).toBe('1')
  })
})
