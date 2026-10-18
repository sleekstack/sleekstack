import { Context, Data } from 'effect'

/** App types printed like the router's own `Route` and `NotFound`. */
export class Route extends Context.Tag('AppRoute')<Route, string>() {}
export class NotFound extends Data.TaggedError('NotFound')<{}> {}
