import { qwikVite } from '@builder.io/qwik/optimizer'
import { resolve } from 'node:path'
import solid from 'vite-plugin-solid'
import { defineConfig, type Plugin } from 'vitest/config'

// Each framework's compiler runs only on its own table (`*.solid.tsx`, `*.qwik.tsx`): both transform JSX, so neither may see the other's
// files or the suites' plain TypeScript. Qwik's generated segment modules keep the file name in their id, so they pass the filter.
const only = (plugins: Plugin | Array<Plugin>, re: RegExp): Array<Plugin> =>
  [plugins].flat().map((p) => {
    const wrap = (hook: unknown) =>
      typeof hook === 'function'
        ? function (this: unknown, code: string, id: string, ...rest: Array<unknown>) {
            return re.test(String(id)) ? (hook as Function).call(this, code, id, ...rest) : null
          }
        : hook
    return { ...p, transform: wrap(p.transform) as Plugin['transform'] }
  })

export default defineConfig({
  plugins: [solid({ include: /\.solid\.tsx$/ }), ...only(qwikVite({ csr: true }), /\.qwik\.tsx/)],
  // Solid's node export is the SSR build (signals are inert); the browser build has the reactive runtime.
  resolve: {
    alias: [
      // Qwik's development build verifies the serializability of every closure on every render: far slower than what ships.
      {
        find: /^@builder\.io\/qwik$/,
        replacement: resolve(import.meta.dirname, 'node_modules/@builder.io/qwik/dist/core.prod.mjs'),
      },
      { find: /^solid-js$/, replacement: 'solid-js/dist/solid.js' },
      { find: /^solid-js\/web$/, replacement: 'solid-js/web/dist/web.js' },
      { find: /^solid-js\/store$/, replacement: 'solid-js/store/dist/store.js' },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Inlined so the aliases above apply inside Solid's own packages: one copy of the reactive runtime.
    server: { deps: { inline: [/solid-js/] } },
    benchmark: { include: ['src/**/*.bench.ts'] },
  },
})
