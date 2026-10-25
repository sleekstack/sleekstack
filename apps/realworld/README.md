# realworld

A [RealWorld](https://github.com/realworld-apps/realworld) ("Conduit") app built on SleekStack, over a `node:sqlite` database.

```sh
pnpm --filter realworld dev     # http://localhost:5173
pnpm --filter realworld test
pnpm --filter realworld check   # sleekstack check: no diagnostics
```

The database is `./data/conduit.db` by default; set `CONDUIT_DB` to use another file (`:memory:` in tests). Tokens are signed with `CONDUIT_SECRET`, which a production boot requires.

## Pages

The pages are file routes under `src/routes` (`@sleekstack/ui-vite`'s routes plugin, in `vite.config.ts`), and `src/app.tsx` passes `virtual:sleekstack/routes` to `router()`. `/` is the Global Feed, `/feed` Your Feed and `/tag/:tag` the tag tab: loaders see only the pathname, so tabs are routes and the page number is a client atom. The other pages are `/login`, `/register`, `/settings`, `/editor` and `/editor/:slug` (signed in only; another user's edit page sends them to the article), `/article/:slug`, `/profile/:username` and `/profile/:username/favorites`.

The root `_layout.tsx` renders the header and footer and declares the `viewer` loader for every page. The `(guarded)` group's layout adds `signedIn`, which sends a signed-out visitor to `/login`. `_notFound.tsx` is the page for an unknown path. Files whose names start with `_` are not routes: they hold what several routes share. `src/pages` holds the shared loaders and the form parts. `src/routes/routes.gen.d.ts` is generated and committed, because `tsc` and `sleekstack check` run without Vite. `vite` and `vite build` rewrite it when a route file is added or removed.

An article body is markdown, rendered by `src/modules/articles/presentation/markdown.ts`: headings, paragraphs, fenced code, flat lists, inline code, strong, emphasis and links. It builds ui nodes, and ui has no raw-HTML node, so HTML in a body shows as text. A link that is not relative, `http:`, `https:` or `mailto:` keeps its label as text and loses the link.

The tests in `test/` run the pages in a browser: each page is server-rendered by the real app, hydrated by `startRouter`, and calls the same app through `fetch`.

## Two server surfaces

Both call the same services in `server/`. The infra is Layer Files (`server/db.layer.ts`, SQLite at `CONDUIT_DB`; `token-secret.layer.ts`; `queries.layer.ts`), found and composed by the Vite plugin, so `server/app.ts` is `start({ router: pages, services })` with no `layer`. The browser's `AppLive` and `QueriesLive` stay hand-written in `src/layers.ts`.

- **Server Services** (`POST /_sleek/fn/<Tag>.<method>`) serve the UI. `IdentityApi`, `ArticlesApi` and `CommentsApi` are RPC Files (`server/identity-api.rpc.ts`, `articles-api.rpc.ts`, `comments-api.rpc.ts`): each exported function is a method, and the build generates the Tag, the client and the implementation Layer, with no contract file and no `implement`. Pages and loaders import the Tag from `virtual:sleek/rpc` and call `yield* <Tag>`, a generated client in the browser and the implementation in process on the server. Each file's `wrap` is `asViewer` from `server/session.ts` (with `SESSION`, `secure` and `signIn`), which authenticates with the `HttpOnly` session cookie, read per call; in `identity-api.rpc.ts` it also covers register, login and logout. They never return the token.
- **The REST facade** (`/api/...`) follows the RealWorld API. Each route is a Controller under `server/routes/api`, one file per path (`articles/[slug].controller.ts` is `/api/articles/:slug`), served by `start` with no route table. The article Controllers (articles, feed, comments, favorite, tags) are class Controllers that declare the `Articles` Service; the user and profile ones are named-export Controller Methods. The directory's `_defaults.ts` `wrap` authenticates with `Authorization: Token <jwt>` only and maps every failure to the table below. Without the header the viewer is anonymous. A bad token, or any other scheme, is 401 on every path, unknown ones and the optional-auth routes included.

REST status codes and error bodies:

| Case                                                    | Status | Body                                                    |
| ------------------------------------------------------- | ------ | ------------------------------------------------------- |
| Blank or taken field, non-numeric `limit`/`offset`      | 422    | `{"errors": {"<field>": ["can't be blank"]}}`           |
| Malformed JSON                                          | 422    | `{"errors": {"body": ["is not valid JSON"]}}`           |
| Missing envelope key (`user`, `article`, `comment`)     | 422    | `{"errors": {"user": ["is missing"]}}`                  |
| No token where one is required, bad token               | 401    | `{"errors": {"token": ["is missing" \| "is invalid"]}}` |
| Wrong email or password                                 | 403    | `{"errors": {"email or password": ["is invalid"]}}`     |
| Not the author                                          | 403    | `{"errors": {"article": ["is not yours"]}}`             |
| Unknown article, comment or profile                     | 404    | `{"errors": {"article": ["not found"]}}`                |
| Unknown `/api/` route or method, non-numeric comment id | 404    | `{"errors": {"body": ["not found"]}}`                   |
| Body over 1 MiB                                         | 413    | `{"errors": {"body": ["is too large"]}}`                |
| Body without `Content-Type: application/json`           | 415    | `{"errors": {"body": ["must be application/json"]}}`    |

Register, create article and add comment answer 201. Deleting an article or a comment answers 204 with no body.

## Postman (Newman) run

This run is manual and is not part of CI. Upstream removed the Postman collection in 2026 in favor of Hurl and Bruno suites. The run below pins the classic collection at commit `1fcad4a`, the last one before the v2 error rules. Start the server on a fresh database, then run the collection against it:

```sh
rm -f /tmp/conduit-newman.db
CONDUIT_DB=/tmp/conduit-newman.db pnpm --filter realworld dev --port 5299 --strictPort &

curl -sfLO https://raw.githubusercontent.com/realworld-apps/realworld/1fcad4a244fd322377b4df67b57acd89e04a756b/api/Conduit.postman_collection.json
U=u$(date +%s)
npx newman run Conduit.postman_collection.json \
  --global-var "APIURL=http://localhost:5299/api" \
  --global-var "USERNAME=$U" --global-var "EMAIL=$U@mail.com" --global-var "PASSWORD=password"
```

Result on 2026-10-18: 32 requests and 311 assertions, 0 failed.

The v2 collection (`365fa47`, February 2026) adds error-case requests. Against it, 7 of 487 assertions fail. Each failure comes from a rule this app's spec decided differently:

- A duplicate email or username: v2 expects 409, the spec says 422.
- A wrong login: v2 expects 401 `credentials: ["invalid"]`, the spec says 403 `email or password`.
- A duplicate title: v2 expects 409, while this app gives the article a suffixed slug (`title-2`).
- Not the author: v2 expects the message `forbidden`, this app sends `is not yours`.

A title change gives the article a new slug, and the response carries it. Neither collection changes a title, so neither tests whether the slug stays the same.
