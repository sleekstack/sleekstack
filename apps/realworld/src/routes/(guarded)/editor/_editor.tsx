/** @jsxImportSource @sleekstack/ui */
import { type DraftSpec, useDraft } from '@sleekstack/model'
import { useLoader } from '@sleekstack/router'
import { useAction, useAtomValue, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { Effect, Schema } from 'effect'
import { Article, createArticleContract, type NewArticle, updateArticleContract } from '../../../modules/articles'
import { Field } from '../../../pages/field'
import { ErrorList, errorsOf, toPage } from '../../../pages/form'
import { ServerFunctions } from '../../../pages/functions'
import { editable } from '../../../pages/loaders'

const articleHref = (slug: string) => `/article/${encodeURIComponent(slug)}`

// `tag` is the tag input, added to `tagList` with Enter; it is not sent. The server checks the required fields.
const EditorForm = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  body: Schema.String,
  tag: Schema.String,
  tagList: Schema.Array(Schema.String),
})
type EditorForm = typeof EditorForm.Type

const EditorDraft = {
  schema: () => EditorForm,
  create: (a) => ({
    title: a?.title ?? '',
    description: a?.description ?? '',
    body: a?.body ?? '',
    tag: '',
    tagList: a?.tagList ?? [],
  }),
  toDto: ({ title, description, body, tagList }) => Effect.succeed({ title, description, body, tagList }),
} satisfies DraftSpec<EditorForm, NewArticle, Article | null>

/** A new article (`article` null) or an edit of `article`; a save lands on the saved article. */
const Editor = function* ({ article }: { article: Article | null }) {
  const call = yield* ServerFunctions
  const draft = yield* useDraft(EditorDraft, article)
  const setBody = yield* useSetAtom(draft.field('body'))
  const setTag = yield* useSetAtom(draft.field('tag'))
  const tagList = yield* useAtomValue(draft.field('tagList'))
  const setTags = yield* useSetAtom(draft.field('tagList'))
  const [saved, save] = yield* useAction(() =>
    Effect.flatMap(draft.toDto(), (dto) =>
      article ? call(updateArticleContract)({ slug: article.slug, article: dto }) : call(createArticleContract)(dto),
    ),
  )
  const { pending } = yield* useFormStatus(saved)
  const outcome = yield* useAtomValue(saved)
  return (
    <div class="editor-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-10 offset-md-1 col-xs-12">
            <ErrorList errors={errorsOf(outcome)} />
            <form action={toPage(saved, save, (a) => articleHref(a.slug))}>
              <fieldset disabled={pending}>
                <Field value={draft.field('title')} placeholder="Article Title" />
                <Field value={draft.field('description')} placeholder="What's this article about?" />
                <fieldset class="form-group">
                  <textarea
                    class="form-control"
                    rows={8}
                    placeholder="Write your article (in markdown)"
                    value={draft.field('body')}
                    onInput={(e) => setBody(e.currentTarget.value)}
                  />
                </fieldset>
                <fieldset class="form-group">
                  <input
                    class="form-control tag-input"
                    type="text"
                    placeholder="Enter tags"
                    value={draft.field('tag')}
                    onInput={(e) => setTag(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      // Enter adds the tag; it does not submit the form.
                      e.preventDefault()
                      const tag = e.currentTarget.value.trim()
                      if (tag && !tagList.includes(tag)) setTags([...tagList, tag])
                      setTag('')
                    }}
                  />
                  <div class="tag-list">
                    {tagList.map((t) => (
                      <span key={t} class="tag-default tag-pill">
                        <i
                          class="ion-close-round"
                          role="button"
                          aria-label={`Remove ${t}`}
                          onClick={() => setTags(tagList.filter((x) => x !== t))}
                        ></i>
                        {t}
                      </span>
                    ))}
                  </div>
                </fieldset>
                <button class="btn btn-lg pull-xs-right btn-primary" type="submit">
                  Publish Article
                </button>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export const NewArticlePage = () => <Editor article={null} />

export const EditArticlePage = function* () {
  const a = yield* Effect.either(useLoader(editable))
  if (a._tag === 'Left') return <div class="container page">The article could not be loaded: try again.</div>
  return <Editor article={a.right} />
}
