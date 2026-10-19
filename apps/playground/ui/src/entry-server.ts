import type { Cause } from 'effect'
import { handle } from '@sleekstack/router'
import { scripts } from 'virtual:sleekstack/client'
import { app } from './app'

/** The routes, for `prerender`. */
export const router = app

// A string render with a `before` function, so the page's `Head` tags land in the head (also in prerendered pages).
const document = {
  before: (head: string) =>
    `<!doctype html><html><head><meta charset="utf-8">${head}${scripts}</head><body><div id="app">`,
  after: '</div></body></html>',
}

export default (request: Request, context?: { onError: (cause: Cause.Cause<unknown>) => void }): Promise<Response> =>
  handle(app, request, { document, onError: context?.onError })
