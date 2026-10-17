import { Context, Effect, Layer, Schema } from 'effect'
import { handle, Link, loader, type Router, router, routes, startRouter } from '@sleekstack/router'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Db extends Context.Tag('Db')<Db, string>() {}

const RepoLive = Layer.succeed(Repo, 'r')
const DbLive = Layer.succeed(Db, 'd')

const table = routes({ home: '/', about: '/about' })
const item = loader('item', Schema.String, Db)

const Home = function* () {
  const r = yield* Repo
  return <Link href="/about" table={table}>{r}</Link>
}
const About = function* () {
  const d = yield* Db
  return <p>{d}</p>
}

const app = router({
  table,
  pages: {
    home: { render: () => <Home /> },
    about: {
      render: () => <About />, // @error MissingDependency
      loaders: [item], // @error MissingDependency
    },
  },
  notFound: () => <About />, // @error MissingDependency
})

const served = router({
  table,
  pages: { home: { render: () => <Home /> }, about: { render: () => <About />, loaders: [item] } },
  notFound: () => <Home />,
})

export const client = (c: Element) => startRouter(app, { container: c, layer: RepoLive })
export const server = (req: Request) => handle(served, req, { layer: Layer.merge(RepoLive, DbLive) })
export const dynamic = (r: Router, c: Element) => startRouter(r, { container: c }) // @error Unresolved
