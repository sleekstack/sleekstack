/** @jsxImportSource @sleekstack/ui */
import { router } from '@sleekstack/router'
import { start } from '@sleekstack/start'
import { Effect } from 'effect'
import { routes } from 'virtual:sleek-content'
import { site } from './site'

const pages = Object.fromEntries(
  Object.entries(routes).map(([name, path]) => [
    name,
    {
      render: () =>
        Effect.flatMap(
          Effect.promise(() => site(path)),
          ({ app }) => (
            <>
              <div id="app">{app}</div>
              <script type="module" src="/src/main.tsx" />
            </>
          ),
        ),
    },
  ]),
)

/** The dev server entry: every page through `start`, in the container and with the script the static build's documents have. */
export const app = start({
  router: router({
    table: routes,
    pages,
    notFound: () => <p>Not found</p>,
  }),
})
