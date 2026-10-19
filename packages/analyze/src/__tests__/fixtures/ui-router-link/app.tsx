import { Context, Layer } from 'effect'
import { Link, router, routes, startRouter } from '@sleekstack/router'
import { Link as LocalLink } from './local'

class Repo extends Context.Tag('Repo')<Repo, string>() {}

const table = routes({ home: '/', about: '/about' })

const Home = function* () {
  const r = yield* Repo
  return (
    <Link href="/about" table={table} class="nav-link" aria-current="page" rel="noopener" data-x="1">
      {r}
    </Link>
  )
}

const app = router({
  table,
  pages: {
    home: { render: () => <Home /> },
    about: { render: () => <LocalLink /> }, // @error MissingDependency
  },
  notFound: () => <Home />,
})

export const client = (c: Element) => startRouter(app, { container: c, layer: Layer.succeed(Repo, 'r') })
