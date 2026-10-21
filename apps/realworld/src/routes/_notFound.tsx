/** @jsxImportSource @sleekstack/ui */
import { Link } from '@sleekstack/router'
import { table } from 'virtual:sleekstack/routes'
import { Footer } from './_footer'

/** The page for a path no route matches. Its header has no viewer-dependent links: no route, so no loaders. */
export default function NotFoundPage() {
  return (
    <>
      <nav class="navbar navbar-light">
        <div class="container">
          <Link table={table} class="navbar-brand" href="/">
            conduit
          </Link>
        </div>
      </nav>
      <div class="container page">
        <h1>Page not found</h1>
        <Link table={table} href="/">
          Back to the home page
        </Link>
      </div>
      <Footer />
    </>
  )
}
