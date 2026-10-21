import type { Middleware } from '@sleekstack/start'
import { Data, Effect, ParseResult, Schema } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../src/errors'
import { ArticleQuery, NewArticle, Page, UpdateArticle } from '../src/modules/articles'
import { NewComment } from '../src/modules/comments'
import { LoginUser, NewUser, UpdateUser, type Viewer } from '../src/modules/identity'
import {
  createArticle,
  deleteArticle,
  favorite,
  feed,
  getArticle,
  listArticles,
  tags,
  unfavorite,
  updateArticle,
} from './articles'
import { addComment, deleteComment, listComments } from './comments'
import type { Db } from './db'
import {
  currentUser,
  follow,
  login,
  profile,
  register,
  type TokenSecret,
  unfollow,
  updateUser,
  ViewerLive,
} from './identity'

const PREFIX = '/api/'

type Failure = ValidationError | Unauthorized | Forbidden | NotFound | ParseResult.ParseError | TooLarge

/** What a route answers: a status and a JSON body, or no body. */
type Reply = readonly [status: number, body?: unknown]

interface Call {
  readonly params: ReadonlyArray<string>
  readonly query: URLSearchParams
  /** The JSON body decoded by `schema`: malformed JSON or a body `schema` rejects is a 422, one over 1 MiB a 413. */
  readonly body: <A, I>(schema: Schema.Schema<A, I>) => Effect.Effect<A, ParseResult.ParseError | TooLarge>
}

type Route = readonly [
  method: string,
  path: RegExp,
  run: (call: Call) => Effect.Effect<Reply, Failure, Db | TokenSecret | Viewer>,
]

const ok =
  (status: number, key: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.map(effect, (value): Reply => [status, { [key]: value }])
const noContent = <E, R>(effect: Effect.Effect<unknown, E, R>) => Effect.as(effect, [204] as Reply)

const envelope = <A, I>(key: string, schema: Schema.Schema<A, I>) => Schema.Struct({ [key]: schema })
const unwrap = <A, I>(call: Call, key: string, schema: Schema.Schema<A, I>) =>
  Effect.map(call.body(envelope(key, schema)), (b) => b[key] as A)

const SLUG = '([^/]+)'
const route = (path: string) => new RegExp(`^${path}$`)

// The RealWorld API, each route over the same service as its Server Service method.
const ROUTES: ReadonlyArray<Route> = [
  ['POST', route('users'), (c) => Effect.flatMap(unwrap(c, 'user', NewUser), register).pipe(ok(201, 'user'))],
  ['POST', route('users/login'), (c) => Effect.flatMap(unwrap(c, 'user', LoginUser), login).pipe(ok(200, 'user'))],
  ['GET', route('user'), () => ok(200, 'user')(currentUser)],
  ['PUT', route('user'), (c) => Effect.flatMap(unwrap(c, 'user', UpdateUser), updateUser).pipe(ok(200, 'user'))],
  ['GET', route(`profiles/${SLUG}`), ({ params: [u] }) => ok(200, 'profile')(profile(u!))],
  ['POST', route(`profiles/${SLUG}/follow`), ({ params: [u] }) => ok(200, 'profile')(follow(u!))],
  ['DELETE', route(`profiles/${SLUG}/follow`), ({ params: [u] }) => ok(200, 'profile')(unfollow(u!))],
  [
    'GET',
    route('articles'),
    ({ query }) =>
      Effect.flatMap(Schema.decodeUnknown(ArticleQuery)(Object.fromEntries(query)), listArticles).pipe(
        Effect.map((list): Reply => [200, list]),
      ),
  ],
  [
    'GET',
    route('articles/feed'),
    ({ query }) =>
      Effect.flatMap(Schema.decodeUnknown(Page)(Object.fromEntries(query)), feed).pipe(
        Effect.map((list): Reply => [200, list]),
      ),
  ],
  [
    'POST',
    route('articles'),
    (c) => Effect.flatMap(unwrap(c, 'article', NewArticle), createArticle).pipe(ok(201, 'article')),
  ],
  ['GET', route(`articles/${SLUG}`), ({ params: [s] }) => ok(200, 'article')(getArticle(s!))],
  [
    'PUT',
    route(`articles/${SLUG}`),
    (c) =>
      Effect.flatMap(unwrap(c, 'article', UpdateArticle), (a) => updateArticle(c.params[0]!, a)).pipe(
        ok(200, 'article'),
      ),
  ],
  ['DELETE', route(`articles/${SLUG}`), ({ params: [s] }) => noContent(deleteArticle(s!))],
  ['POST', route(`articles/${SLUG}/favorite`), ({ params: [s] }) => ok(200, 'article')(favorite(s!))],
  ['DELETE', route(`articles/${SLUG}/favorite`), ({ params: [s] }) => ok(200, 'article')(unfavorite(s!))],
  ['GET', route(`articles/${SLUG}/comments`), ({ params: [s] }) => ok(200, 'comments')(listComments(s!))],
  [
    'POST',
    route(`articles/${SLUG}/comments`),
    (c) =>
      Effect.flatMap(unwrap(c, 'comment', NewComment), (n) => addComment(c.params[0]!, n)).pipe(ok(201, 'comment')),
  ],
  [
    'DELETE',
    route(`articles/${SLUG}/comments/(\\d+)`),
    ({ params: [s, id] }) => noContent(deleteComment(s!, Number(id))),
  ],
  ['GET', route('tags'), () => ok(200, 'tags')(tags)],
]

const errors = (status: number, errors: Record<string, ReadonlyArray<string>>): Reply => [status, { errors }]

/** A ParseError's issues keyed by their path (`user.email`), or `body` for the whole request. */
const parseErrors = (error: ParseResult.ParseError) => {
  const out: Record<string, string[]> = {}
  for (const issue of ParseResult.ArrayFormatter.formatErrorSync(error))
    (out[issue.path.join('.') || 'body'] ??= []).push(issue.message)
  return out
}

/** The one mapping of the tagged domain errors onto RealWorld statuses and `{errors}` bodies. */
const failure = (error: Failure, hasToken: boolean): Reply => {
  switch (error._tag) {
    case 'ParseError':
      return errors(422, parseErrors(error))
    case 'TooLarge':
      return errors(413, { body: ['is too large'] })
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

/** A request body over the limit (start's server-function limit, 1 MiB): 413. */
class TooLarge extends Data.TaggedError('TooLarge') {}
const BODY_LIMIT = 1024 * 1024

/** The body's text, or `undefined` once it passes `BODY_LIMIT` (its declared length or the bytes read so far). */
const readText = async (request: Request) => {
  if (Number(request.headers.get('content-length')) > BODY_LIMIT) return undefined
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request.body ?? []) {
    size += chunk.byteLength
    // Leaving the loop cancels the stream: the rest is never read.
    if (size > BODY_LIMIT) return undefined
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const readJson = (request: Request) =>
  Effect.flatMap(
    Effect.promise(() => readText(request)),
    (text): Effect.Effect<unknown, ParseResult.ParseError | TooLarge> =>
      text === undefined
        ? Effect.fail(new TooLarge())
        : Effect.try({
            try: () => JSON.parse(text) as unknown,
            catch: () =>
              new ParseResult.ParseError({
                issue: new ParseResult.Type(Schema.Unknown.ast, undefined, 'is not valid JSON'),
              }),
          }),
  )

/** `Authorization: Token <jwt>`: `undefined` without the header; any other scheme is a token that fails to verify. */
const tokenOf = (request: Request) => {
  const header = request.headers.get('authorization')
  if (header === null) return undefined
  return /^Token (\S+)$/.exec(header)?.[1] ?? ''
}

/** The route's decoded path parameters, or `undefined` when one is not valid percent-encoding. */
const decodeParams = (match: RegExpExecArray) => {
  try {
    return match.slice(1).map(decodeURIComponent)
  } catch {
    return undefined
  }
}

const json = ([status, body]: Reply) =>
  body === undefined ? new Response(null, { status }) : Response.json(body, { status })

/**
 * The RealWorld REST facade at `/api/`: every route resolves the viewer from `Authorization: Token` (anonymous
 * without one, 401 for a bad one) and calls the same service as its Server Service method. It answers every `/api/`
 * request itself, an unknown one with 404, and passes every other path on.
 */
export const rest: Middleware<never, Db | TokenSecret> = (request) => {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(PREFIX)) return Effect.void
  const path = url.pathname.slice(PREFIX.length)
  const token = tokenOf(request)
  let match: RegExpExecArray | null = null
  const found = ROUTES.find(([method, pattern]) => method === request.method && (match = pattern.exec(path)))
  const params = match && decodeParams(match)
  if (!found || !params) return Effect.succeed(json(errors(404, { body: ['not found'] })))
  const call: Call = {
    params,
    query: url.searchParams,
    body: (schema) => Effect.flatMap(readJson(request), Schema.decodeUnknown(schema)),
  }
  return found[2](call).pipe(
    Effect.provide(ViewerLive(token)),
    Effect.catchAll((error: Failure) => Effect.succeed(failure(error, token !== undefined))),
    Effect.map(json),
  )
}
