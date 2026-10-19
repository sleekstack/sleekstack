// @vitest-environment jsdom
import { Readable } from 'node:stream'
import { flush, render } from '@sleekstack/testing'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Layer } from 'effect'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { app } from '../server/app'
import { devMiddleware } from '../server/dev'
import { ServerFnDemo } from '../src/pages/server'

afterEach(() => void vi.unstubAllGlobals())

it('the form adds an item through the server function; a duplicate or an empty title shows its typed failure', async () => {
  // The browser's `fetch`, answered by the server entry itself (no network); same origin, so it sends `Origin`.
  const serve = vi.fn((url: string, init: RequestInit) =>
    app.fetch(
      new Request(new URL(url, location.origin), { ...init, headers: { ...init.headers, origin: location.origin } }),
    ),
  )
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
  expect(await respond('GET', '/')).toEqual({ next: true })
})
