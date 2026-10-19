import { Context } from 'effect'

export class Session extends Context.Tag('Session')<Session, string>() {}

/** An app component that shares the router's name: checked like any app component, never as the router's. */
export const Link = function* () {
  const s = yield* Session
  return <a href="/">{s}</a>
}
