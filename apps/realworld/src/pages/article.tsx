/** @jsxImportSource @sleekstack/ui */
import { type DraftSpec, useDraft } from '@sleekstack/model'
import { loader, notFound, Route, useLoader } from '@sleekstack/router'
import { useAction, useAtomValue, useFormStatus, useLocal, useSetAtom } from '@sleekstack/ui'
import { Effect, Schema } from 'effect'
import {
  Article,
  deleteArticleContract,
  FavoriteButton,
  favoriteContract,
  formatDate,
  getArticleContract,
  markdown,
  type Toggle,
  unfavoriteContract,
} from '../modules/articles'
import {
  addCommentContract,
  Comment,
  deleteCommentContract,
  listCommentsContract,
  NewComment,
} from '../modules/comments'
import type { Account } from '../modules/identity'
import { ErrorList, errorsOf, toHome } from './form'
import { ServerFunctions } from './functions'
import { Layout, viewer } from './layout'
import { FollowButton } from './profile'

const profileHref = (username: string) => `/profile/${encodeURIComponent(username)}`

// The article and editor routes both name the article `:slug`.
const slug = Effect.map(Route, (m) => m.params['slug']!)

/** The article the route names; an unknown slug is the 404 page. */
export const article = loader(
  'article',
  Article,
  Effect.flatMap(Effect.zip(ServerFunctions, slug), ([call, s]) => call(getArticleContract)({ slug: s })).pipe(
    Effect.catchTag('NotFound', notFound),
  ),
)

/** The article's comments, newest first. */
export const comments = loader(
  'comments',
  Schema.Array(Comment),
  Effect.flatMap(Effect.zip(ServerFunctions, slug), ([call, s]) => call(listCommentsContract)({ slug: s })).pipe(
    Effect.catchTag('NotFound', notFound),
  ),
)

/** The author's Edit and Delete buttons; a delete lands on `/`. */
const OwnerActions = function* ({ slug }: { slug: string }) {
  const call = yield* ServerFunctions
  const [deleted, remove] = yield* useAction(() => call(deleteArticleContract)({ slug }))
  const { pending } = yield* useFormStatus(deleted)
  const outcome = yield* useAtomValue(deleted)
  return (
    <>
      <a class="btn btn-sm btn-outline-secondary" href={`/editor/${encodeURIComponent(slug)}`}>
        <i class="ion-edit"></i> Edit Article
      </a>{' '}
      <form class="delete-article" style="display: inline" action={toHome(deleted, remove)}>
        <button class="btn btn-sm btn-outline-danger" type="submit" disabled={pending}>
          <i class="ion-trash-a"></i> Delete Article
        </button>
      </form>
      <ErrorList errors={errorsOf(outcome)} />
    </>
  )
}

/** The author row: Edit and Delete for the author, Follow and Favorite for anyone else. */
const ArticleMeta = function* ({ article, me }: { article: Article; me: Account | null }) {
  const call = yield* ServerFunctions
  const toggle: Toggle | null = me
    ? (a) => call(a.favorited ? unfavoriteContract : favoriteContract)({ slug: a.slug })
    : null
  const { author } = article
  return (
    <div class="article-meta">
      <a href={profileHref(author.username)}>{author.image && <img src={author.image} alt="" />}</a>
      <div class="info">
        <a href={profileHref(author.username)} class="author">
          {author.username}
        </a>
        <span class="date">{formatDate(article.createdAt)}</span>
      </div>
      {me?.username === author.username ? (
        <OwnerActions slug={article.slug} />
      ) : (
        <>
          <FollowButton user={author} signedIn={me !== null} />
          <FavoriteButton article={article} toggle={toggle} />
        </>
      )}
    </div>
  )
}

const CommentDraft = {
  schema: () => NewComment,
  create: () => ({ body: '' }),
  toDto: (d) => Effect.succeed(d),
} satisfies DraftSpec<NewComment, NewComment>

/** The new-comment form; a posted comment goes to `onAdded` and the form clears. */
const CommentForm = function* ({
  slug,
  me,
  onAdded,
}: {
  slug: string
  me: Account
  onAdded: (comment: Comment) => void
}) {
  const call = yield* ServerFunctions
  const draft = yield* useDraft(CommentDraft, undefined)
  const setBody = yield* useSetAtom(draft.field('body'))
  const [added, add] = yield* useAction(() =>
    Effect.flatMap(draft.toDto(), (comment) => call(addCommentContract)({ slug, comment })).pipe(
      Effect.tap((comment) =>
        Effect.sync(() => {
          onAdded(comment)
          draft.reset()
        }),
      ),
    ),
  )
  const { pending } = yield* useFormStatus(added)
  const outcome = yield* useAtomValue(added)
  return (
    <>
      <ErrorList errors={errorsOf(outcome)} />
      <form class="card comment-form" action={add}>
        {/* Read-only while posting: a success clears the Draft, which would drop text typed meanwhile. */}
        <fieldset class="card-block" disabled={pending}>
          <textarea
            class="form-control"
            placeholder="Write a comment..."
            rows={3}
            value={draft.field('body')}
            onInput={(e) => setBody(e.currentTarget.value)}
          ></textarea>
        </fieldset>
        <div class="card-footer">
          {me.image && <img src={me.image} class="comment-author-img" alt="" />}
          <button class="btn btn-sm btn-primary" type="submit" disabled={pending}>
            Post Comment
          </button>
        </div>
      </form>
    </>
  )
}

/** One comment; its author gets a delete button, and a deleted comment goes to `onDeleted`. */
const CommentCard = function* ({
  slug,
  comment,
  mine,
  onDeleted,
}: {
  slug: string
  comment: Comment
  mine: boolean
  onDeleted: (id: number) => void
}) {
  const call = yield* ServerFunctions
  const [deleted, remove] = yield* useAction(() =>
    call(deleteCommentContract)({ slug, id: comment.id }).pipe(
      Effect.tap(() => Effect.sync(() => onDeleted(comment.id))),
    ),
  )
  const { pending } = yield* useFormStatus(deleted)
  const outcome = yield* useAtomValue(deleted)
  const { author } = comment
  return (
    <div class="card">
      <div class="card-block">
        <p class="card-text">{comment.body}</p>
      </div>
      <div class="card-footer">
        <a href={profileHref(author.username)} class="comment-author">
          {author.image && <img src={author.image} class="comment-author-img" alt="" />}
        </a>{' '}
        <a href={profileHref(author.username)} class="comment-author">
          {author.username}
        </a>
        <span class="date-posted">{formatDate(comment.createdAt)}</span>
        {mine && (
          <form class="mod-options" action={remove}>
            <button type="submit" class="btn btn-sm btn-link" disabled={pending} aria-label="Delete comment">
              <i class="ion-trash-a"></i>
            </button>
          </form>
        )}
      </div>
      <ErrorList errors={errorsOf(outcome)} />
    </div>
  )
}

/** Edits since the loader's list: `base` is the list they apply to, so a reloaded list drops them. */
interface Edited {
  readonly base: ReadonlyArray<Comment>
  readonly list: ReadonlyArray<Comment>
}

/** The comment form (or a sign-in prompt) and the comments, newest first. */
const Comments = function* ({ slug, me }: { slug: string; me: Account | null }) {
  const loaded = yield* Effect.either(useLoader(comments))
  const [edited, setEdited] = yield* useLocal<Edited | null>(null)
  if (loaded._tag === 'Left') return <div>The comments could not be loaded: try again.</div>
  const base = loaded.right
  const list = edited?.base === base ? edited.list : base
  const edit = (f: (list: ReadonlyArray<Comment>) => ReadonlyArray<Comment>) =>
    setEdited((prev) => ({ base, list: f(prev?.base === base ? prev.list : base) }))
  return (
    <>
      {me ? (
        <CommentForm slug={slug} me={me} onAdded={(c) => edit((l) => [c, ...l])} />
      ) : (
        <p>
          <a href="/login">Sign in</a> or <a href="/register">sign up</a> to add comments on this article.
        </p>
      )}
      {list.map((c) => (
        <CommentCard
          key={c.id}
          slug={slug}
          comment={c}
          mine={me?.username === c.author.username}
          onDeleted={(id) => edit((l) => l.filter((x) => x.id !== id))}
        />
      ))}
    </>
  )
}

const ArticleView = function* () {
  const shown = yield* Effect.either(useLoader(article))
  const me = yield* Effect.orElseSucceed(useLoader(viewer), () => null)
  if (shown._tag === 'Left') return <div class="container page">The article could not be loaded: try again.</div>
  const a = shown.right
  return (
    <div class="article-page">
      <div class="banner">
        <div class="container">
          <h1>{a.title}</h1>
          <ArticleMeta article={a} me={me} />
        </div>
      </div>
      <div class="container page">
        <div class="row article-content">
          <div class="col-md-12">
            {markdown(a.body)}
            <ul class="tag-list">
              {a.tagList.map((t) => (
                <li key={t} class="tag-default tag-pill tag-outline">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <hr />
        <div class="row">
          <div class="col-xs-12 col-md-8 offset-md-2">
            <Comments slug={a.slug} me={me} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const ArticlePage = () => (
  <Layout>
    <ArticleView />
  </Layout>
)
