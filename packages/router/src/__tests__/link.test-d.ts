import { Atom } from '@sleekstack/core'
import { Context, Effect, Schema } from 'effect'
import { Link, loader, type LinkProps, routes } from '../index'

class Db extends Context.Tag('Db')<Db, string>() {}
const table = routes({ home: '/' })
const user = loader('user', Schema.String, Db)

export const checks = () => [
  Link({
    href: '/',
    table,
    class: 'nav',
    id: 'x',
    rel: 'noopener',
    target: '_blank',
    'aria-current': 'page',
    'data-x': '1',
  }),
  Link({ href: '/', table, className: 'nav' }),
  // @ts-expect-error `class` and `className` are one-of-never-both
  Link({ href: '/', table, class: 'a', className: 'b' }),
  // @ts-expect-error `href` is required
  Link({ table }),
  // @ts-expect-error `table` is required
  Link({ href: '/' }),
  // @ts-expect-error `href` is a plain string, not an atom
  Link({ href: Atom.make('/'), table }),
  // @ts-expect-error event handlers are not accepted
  Link({ href: '/', table, onClick: () => Effect.void }),
  // @ts-expect-error event handlers are not accepted
  Link({ href: '/', table, onMouseEnter: () => Effect.void }),
]

// `R` is still inferred from `loaders`.
export const inferred: LinkProps<Db> = { href: '/', table, loaders: [user] }
export const call = Link({ href: '/', table, loaders: [user] })
