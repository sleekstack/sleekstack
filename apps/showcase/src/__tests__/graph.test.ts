/**
 * apps/showcase/src/__tests__/graph.test.ts
 *
 * /graph lists every analyzer root with its kind: the app root, RequestLive and DemoLive.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import GraphPage from '../../app/graph/page'

describe('/graph', () => {
  it('lists RequestLive and DemoLive with their kind, after the app root', () => {
    const html = renderToStaticMarkup(createElement(GraphPage))
    const app = html.indexOf('[app]')
    expect(app).toBeGreaterThan(-1)
    expect(html.indexOf('RequestLive [request]')).toBeGreaterThan(app)
    expect(html.indexOf('DemoLive [overrides]')).toBeGreaterThan(app)
  })
})
