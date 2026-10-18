import { Context, Effect, Layer, Schema } from 'effect'
import { handle, Link, loader, notFound, Route, type Router, router, routes, startRouter } from '@sleekstack/router'
import { NotFound as AppNotFound, Route as AppRoute } from './tags'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Db extends Context.Tag('Db')<Db, string>() {}

const RepoLive = Layer.succeed(Repo, 'r')
const DbLive = Layer.succeed(Db, 'd')

const table = routes({ home: '/', about: '/about' })
const item = loader('item', Schema.String, Db)

const Home = function* () {
  const r = yield* Repo
  return (
    <Link href="/about" table={table}>
      {r}
    </Link>
  )
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

const edgeTable = routes({ home: '/', about: '/about', fails: '/fails', gone: '/gone' })
const Here = function* () {
  const m = yield* Route
  return <p>{m.name}</p>
}
const UsesAppRoute = function* () {
  const r = yield* AppRoute
  return <p>{r}</p>
}
const Fails = function* () {
  yield* new AppNotFound()
  return <p />
}
const Gone = function* () {
  yield* notFound()
  return <p />
}
const render = () => <Here />
const edgeNotFound = () => <Here /> // @error MissingDependency

const edge = router({
  table: edgeTable,
  pages: {
    home: { render },
    about: { render: () => <UsesAppRoute /> }, // @error MissingDependency
    fails: { render: () => <Fails /> }, // @error UnhandledError
    gone: { render: () => <Gone /> },
  },
  notFound: edgeNotFound,
})

export const edgeClient = (c: Element) => startRouter(edge, { container: c })
