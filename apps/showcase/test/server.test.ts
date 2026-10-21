// @vitest-environment jsdom
import { Readable } from 'node:stream'
import { callService, flush, render } from '@sleekstack/testing'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Effect, Exit, Layer } from 'effect'
import ServerServicesLive from 'virtual:sleek/server'
import services from 'virtual:sleek/server-registry'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { app } from '../server/app'
import { devMiddleware } from '../server/dev'
import { ServerFnDemo } from '../src/pages/server'
import { Tally, TallyLimit } from '../src/pages/tally'

afterEach(() => void vi.unstubAllGlobals())

/** The browser's `fetch`, answered by the server entry itself (no network); same origin, so it sends `Origin`. */
const serveFromApp = () =>
  vi.fn((url: string, init: RequestInit) =>
    app.fetch(
      new Request(new URL(url, location.origin), { ...init, headers: { ...init.headers, origin: location.origin } }),
    ),
  )

it('the form adds an item through the server function; a duplicate or an empty title shows its typed failure', async () => {
  const serve = serveFromApp()
  vi.stubGlobal('fetch', serve)
  const { container, dispose } = await render(jsx(ServerFnDemo, {}), { layer: Layer.empty })
  const text = (s: string) => container.querySelector(s)?.textContent
  const submit = async (title: string) => {
    container.querySelector<HTMLInputElement>('input.title')!.value = title
    await act(async () => container.querySelector('form')!.requestSubmit())
    await flush()
  }

  await submit('milk')
  await vi.waitFor(() => expect(text('.list')).toBe('milk'))
  expect(serve).toHaveBeenCalledWith('/_sleek/fn/items.add', expect.objectContaining({ method: 'POST' }))

  await submit('milk')
  await vi.waitFor(() => expect(text('.error')).toBe('milk is on the list already'))
  expect(text('.list')).toBe('milk') // the last list stays

  serve.mockClear()
  await submit('')
  await vi.waitFor(() => expect(text('.error')).toBe('Enter a title'))
  expect(serve).not.toHaveBeenCalled() // the input Schema fails before any request
  await dispose()
})

it('the dev server middleware answers POST /_sleek/fn/<id> through start, and passes every other path to Vite', async () => {
  const host = 'localhost:5173'
  const request = (method: string, url: string, body?: string) =>
    Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(body)]), {
      method,
      url,
      headers: { host, origin: `http://${host}`, 'content-type': 'application/json' },
    })
  const respond = (method: string, url: string, body?: string) =>
    new Promise<{ status?: number; body?: string; next: boolean }>((resolve, reject) => {
      const res = {
        statusCode: 200,
        setHeader: () => res,
        end: (chunk: Buffer) => resolve({ status: res.statusCode, body: chunk.toString(), next: false }),
      }
      devMiddleware(async () => app)(request(method, url, body) as never, res as never, (error) =>
        error ? reject(error) : resolve({ next: true }),
      )
    })

  const added = await respond('POST', '/_sleek/fn/items.add', JSON.stringify({ title: 'tea' }))
  expect(added.status).toBe(200)
  expect(JSON.parse(added.body!)).toEqual({ _tag: 'Success', value: expect.arrayContaining(['tea']) })
  // The Server Service's generated ids, through the same endpoint.
  const before = JSON.parse((await respond('POST', '/_sleek/fn/Tally.read', '')).body!)
  expect(before).toEqual({ _tag: 'Success', value: expect.any(Number) })
  expect(JSON.parse((await respond('POST', '/_sleek/fn/Tally.add', JSON.stringify({ by: 0 }))).body!)).toEqual(before)
  expect(await respond('GET', '/')).toEqual({ next: true })
})

it('the Tally form adds through the generated client; past the limit the declared TallyLimit arrives typed', async () => {
  const serve = serveFromApp()
  vi.stubGlobal('fetch', serve)
  const { container, dispose } = await render(jsx(ServerFnDemo, {}), { layer: ServerServicesLive })
  const text = (s: string) => container.querySelector(s)?.textContent
  const add = async () => {
    await act(async () => container.querySelector<HTMLFormElement>('form.tally')!.requestSubmit())
    await flush()
  }

  for (const n of [1, 2, 3]) {
    await add()
    await vi.waitFor(() => expect(text('.count')).toBe(String(n)))
  }
  expect(serve).toHaveBeenCalledWith('/_sleek/fn/Tally.add', expect.objectContaining({ method: 'POST' }))
  await add()
  await vi.waitFor(() => expect(text('.error')).toBe('The tally stops at 3'))
  expect(text('.count')).toBe('3') // the last count stays
  await dispose()
})

it('a test Layer swaps the implementation: plain DI and callService need no network', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const Full = Layer.succeed(Tally, {
    add: () => Effect.fail(new TallyLimit({ limit: 0 })),
    read: () => Effect.succeed(7),
  })
  expect(
    await Effect.runPromise(
      Effect.provide(
        Effect.flatMap(Tally, (t) => t.read()),
        Full,
      ),
    ),
  ).toBe(7)
  const entry = services.find((s) => s.tag === Tally)!
  expect(await callService(entry, 'read', undefined, { layer: Full })).toEqual(Exit.succeed(7))
  const limited = await callService(entry, 'add', { by: 1 }, { layer: Full })
  expect(limited).toEqual(Exit.fail(new TallyLimit({ limit: 0 })))
  expect(fetch).not.toHaveBeenCalled()
})
