import { Context, type Option } from 'effect'

/** A signed-in viewer: their user id and the token they presented. */
export interface SignedIn {
  readonly id: number
  readonly token: string
}

/** Who is making the request, resolved once per request from its token; `None` is anonymous. */
export class Viewer extends Context.Tag('realworld/identity/Viewer')<Viewer, Option.Option<SignedIn>>() {}
