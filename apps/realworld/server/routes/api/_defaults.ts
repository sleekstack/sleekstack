import type { BodyTooLarge, InvalidPathEncoding, MethodNotAllowed, UnsupportedMediaType } from '@sleekstack/start'
import { Effect, ParseResult } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../src/errors'
import type { Viewer } from '../../../src/modules/identity'
import type { Db } from '../../db'
import { type TokenSecret, ViewerLive } from '../../identity'

/** What a Controller under `/api/` fails with, its HTTP face's routing and decode failures included. */
type Failure =
  | ValidationError
  | Unauthorized
  | Forbidden
  | NotFound
  | ParseResult.ParseError
  | InvalidPathEncoding
  | MethodNotAllowed
  | BodyTooLarge
  | UnsupportedMediaType

const errors = (status: number, errors: Record<string, ReadonlyArray<string>>) => Response.json({ errors }, { status })

/** No such route: an unknown path, an unsupported method, a malformed escape or a path param that fails to decode. */
const noRoute = () => errors(404, { body: ['not found'] })

/**
 * A failed decode: 404 when a path param fails, else 422 with each issue keyed by its path below the input part
 * (`user.email`), or `body` for the whole body.
 */
const decodeFailure = (error: ParseResult.ParseError) => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error)
  if (issues.some((issue) => issue.path[0] === 'params')) return noRoute()
  const out: Record<string, string[]> = {}
  for (const { path, message } of issues) (out[path.slice(1).join('.') || 'body'] ??= []).push(message)
  return errors(422, out)
}

/** The one mapping of the tagged errors onto RealWorld statuses and `{errors}` bodies. */
const failure = (error: Failure, hasToken: boolean) => {
  switch (error._tag) {
    case 'ParseError':
      return decodeFailure(error)
    case 'InvalidPathEncoding':
    case 'MethodNotAllowed':
      return noRoute()
    case 'BodyTooLarge':
      return errors(413, { body: ['is too large'] })
    case 'UnsupportedMediaType':
      return errors(415, { body: ['must be application/json'] })
    case 'ValidationError':
      return errors(422, error.errors)
    case 'Unauthorized':
      return errors(401, { token: [hasToken ? 'is invalid' : 'is missing'] })
    case 'Forbidden':
      return errors(403, error.errors)
    case 'NotFound':
      return errors(404, { [error.resource]: ['not found'] })
  }
}

/** `Authorization: Token <jwt>`: `undefined` without the header; any other scheme is a token that fails to verify. */
const tokenOf = (request: Request) => {
  const header = request.headers.get('authorization')
  if (header === null) return undefined
  return /^Token (\S+)$/.exec(header)?.[1] ?? ''
}

/**
 * Every Controller under `/api/` runs as the viewer from `Authorization: Token` (anonymous without one, 401 for a bad
 * one, on any path, since routing runs inside this `wrap`) and answers its failures as RealWorld errors.
 */
export const wrap = (
  next: Effect.Effect<Response, Failure, Viewer>,
  request: Request,
): Effect.Effect<Response, never, Db | TokenSecret> => {
  const token = tokenOf(request)
  return next.pipe(
    Effect.provide(ViewerLive(token)),
    Effect.catchAll((error) => Effect.succeed(failure(error, token !== undefined))),
  )
}
