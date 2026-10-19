import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createBuilder } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type PrerenderOption, sleekstack } from '../../index.js'

// The app is written to a temp dir inside the package, so the built server bundle resolves its dependencies.
const root = mkdtempSync(join(resolve(import.meta.dirname, '../../..'), '.tmp-prerender-'))

const server = `import { handle, loader, router as make, useLoader } from '@sleekstack/router'
import { type Cause, Effect, Schema } from 'effect'
import { scripts } from 'virtual:sleekstack/client'

const greeting = loader('greeting', Schema.String, Effect.succeed('hello from loader'))
const broken = loader('broken', Schema.String, Effect.fail(new Error('loader boom')))

function* Greeting() {
  return <h1>{yield* useLoader(greeting)}</h1>
}
function* Crash() {
  yield* Effect.die(new Error('render boom'))
  return <p />
}

export const router = make({
  table: { index: '/', user: '/users/:id', broken: '/broken', crash: '/crash', file: '/files/:name' },
  pages: {
    index: { loaders: [greeting], render: () => <Greeting /> },
    user: { prerender: async () => [{ id: '1' }, { id: 'a b' }], render: () => <p>user page</p> },
    broken: { loaders: [broken], render: () => <p>broken</p> },
    crash: { render: () => <Crash /> },
    file: { render: () => <p>file</p> },
  },
  notFound: () => <h1>Not found</h1>,
})

const document = {
  before: \`<!doctype html><html><head><title>Prerendered</title>\${scripts}</head><body><div id="app">\`,
  after: '</div></body></html>',
}

export default (request: Request, context?: { onError: (cause: Cause.Cause<unknown>) => void }) =>
  handle(router, request, { stream: true, document, onError: context?.onError })
`

const build = async (prerender: PrerenderOption, out: string) => {
  const builder = await createBuilder({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: sleekstack({
      include: '**/*.tsx',
      entries: { client: 'client.ts', server: 'server.tsx' },
      prerender,
    }),
    environments: {
      client: { build: { outDir: `${out}/client` } },
      ssr: { build: { outDir: `${out}/server` } },
    },
  })
  await builder.buildApp()
  return join(root, out, 'client')
}

beforeAll(() => {
  mkdirSync(join(root, 'routes'))
  writeFileSync(join(root, 'client.ts'), 'export const client = 1\n')
  writeFileSync(join(root, 'server.tsx'), server)
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('prerender build', () => {
  let client: string
  beforeAll(async () => {
    client = await build(['/'], 'ok')
  })

  it('writes the listed and expanded paths with rendered content, head tags and loader data (R1)', () => {
    const home = readFileSync(join(client, 'index.html'), 'utf8')
    expect(home).toContain('<title>Prerendered</title>')
    expect(home).toMatch(/<script type="module" src="\/assets\/[^"]+\.js"><\/script>/)
    expect(home).toContain('<h1>hello from loader</h1>')
    expect(home).toContain('data-sleek-hydrate')
    expect(readFileSync(join(client, 'users/1/index.html'), 'utf8')).toContain('<p>user page</p>')
    expect(existsSync(join(client, 'users/a b/index.html'))).toBe(true)
    expect(existsSync(join(client, 'broken'))).toBe(false)
  })

  it.each([
    ['a loader failure', '/broken', 'status 500'],
    ['a render failure', '/crash', 'render boom'],
    ['an encoded separator', '/files/a%2F..%2Findex', "segment 'a/../index'"],
  ])('fails the build naming the route on %s (R3)', async (_, path, why) => {
    const error = await build([path], `fail${path.replace(/%/g, '')}`).catch((e: Error) => e)
    expect(String(error)).toContain(`prerender: route ${path} failed: `)
    expect(String(error)).toContain(why)
  })
})
