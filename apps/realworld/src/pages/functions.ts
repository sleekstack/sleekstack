import { client, type Contract, type Stub } from '@sleekstack/start/client'
import { Context, Layer } from 'effect'

/**
 * Calls a Server Function by its contract. The browser's calls go over the wire (`client` stubs); the server's, made by
 * loaders while it renders a page, run the function in place in the request's Request Scope, session cookie included.
 */
export class ServerFunctions extends Context.Tag('realworld/ServerFunctions')<
  ServerFunctions,
  <C extends Contract>(contract: C) => Stub<C>
>() {}

/** The browser's `ServerFunctions`: a `client` stub per contract. */
export const ServerFunctionsClient = Layer.succeed(ServerFunctions, client)
