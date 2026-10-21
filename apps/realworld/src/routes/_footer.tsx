/** @jsxImportSource @sleekstack/ui */
import { Link } from '@sleekstack/router'
import { table } from 'virtual:sleekstack/routes'

/** Every page's footer, the not-found page's included. */
export const Footer = () => (
  <footer>
    <div class="container">
      <Link table={table} href="/" class="logo-font">
        conduit
      </Link>
      <span class="attribution">
        An interactive learning project from <a href="https://thinkster.io">Thinkster</a>. Code &amp; design licensed
        under MIT.
      </span>
    </div>
  </footer>
)
