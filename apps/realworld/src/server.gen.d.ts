// Written by @sleekstack/ui-vite from the Server Service contracts, the Controllers, the RPC Files, and the Layer Files; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import('virtual:sleek/rpc').ArticlesApi | import('virtual:sleek/rpc').CommentsApi | import('virtual:sleek/rpc').IdentityApi>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import('virtual:sleek/rpc').ArticlesApi | typeof import('virtual:sleek/rpc').CommentsApi | typeof import('virtual:sleek/rpc').IdentityApi>>
  export default services
}
declare module 'virtual:sleek/rpc' {
  export interface ArticlesApi {
    readonly 'virtual:sleek/rpc': "ArticlesApi"
  }
  export const ArticlesApi: import('effect').Context.Tag<ArticlesApi, import('@sleekstack/start').GeneratedServiceShape<Pick<typeof import("../server/articles-api.rpc"), "create" | "delete" | "favorite" | "feed" | "get" | "list" | "tags" | "unfavorite" | "update">>>
  export interface CommentsApi {
    readonly 'virtual:sleek/rpc': "CommentsApi"
  }
  export const CommentsApi: import('effect').Context.Tag<CommentsApi, import('@sleekstack/start').GeneratedServiceShape<Pick<typeof import("../server/comments-api.rpc"), "add" | "delete" | "list">>>
  export interface IdentityApi {
    readonly 'virtual:sleek/rpc': "IdentityApi"
  }
  export const IdentityApi: import('effect').Context.Tag<IdentityApi, import('@sleekstack/start').GeneratedServiceShape<Pick<typeof import("../server/identity-api.rpc"), "current" | "follow" | "login" | "logout" | "profile" | "register" | "unfollow" | "update">>>
}
declare module 'virtual:sleek/server-app' {
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {
    readonly ArticlesApi: import('virtual:sleek/rpc').ArticlesApi
    readonly CommentsApi: import('virtual:sleek/rpc').CommentsApi
    readonly IdentityApi: import('virtual:sleek/rpc').IdentityApi
  }
}
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly "api/index": "/api"
    readonly "api/articles": "/api/articles"
    readonly "api/articles/feed": "/api/articles/feed"
    readonly "api/articles/[slug]": "/api/articles/:slug"
    readonly "api/articles/[slug]/comments": "/api/articles/:slug/comments"
    readonly "api/articles/[slug]/comments/[id]": "/api/articles/:slug/comments/:id"
    readonly "api/articles/[slug]/favorite": "/api/articles/:slug/favorite"
    readonly "api/profiles/[username]": "/api/profiles/:username"
    readonly "api/profiles/[username]/follow": "/api/profiles/:username/follow"
    readonly "api/tags": "/api/tags"
    readonly "api/user": "/api/user"
    readonly "api/users": "/api/users"
    readonly "api/users/login": "/api/users/login"
    readonly "api/[...rest]": "/api/*rest"
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly "api/index": typeof import("../server/routes/api/index.controller")
    readonly "api/articles": typeof import("../server/routes/api/articles.controller")
    readonly "api/articles/feed": typeof import("../server/routes/api/articles/feed.controller")
    readonly "api/articles/[slug]": typeof import("../server/routes/api/articles/[slug].controller")
    readonly "api/articles/[slug]/comments": typeof import("../server/routes/api/articles/[slug]/comments.controller")
    readonly "api/articles/[slug]/comments/[id]": typeof import("../server/routes/api/articles/[slug]/comments/[id].controller")
    readonly "api/articles/[slug]/favorite": typeof import("../server/routes/api/articles/[slug]/favorite.controller")
    readonly "api/profiles/[username]": typeof import("../server/routes/api/profiles/[username].controller")
    readonly "api/profiles/[username]/follow": typeof import("../server/routes/api/profiles/[username]/follow.controller")
    readonly "api/tags": typeof import("../server/routes/api/tags.controller")
    readonly "api/user": typeof import("../server/routes/api/user.controller")
    readonly "api/users": typeof import("../server/routes/api/users.controller")
    readonly "api/users/login": typeof import("../server/routes/api/users/login.controller")
    readonly "api/[...rest]": typeof import("../server/routes/api/[...rest].controller")
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
declare module 'virtual:sleek/server-app' {
  /** What each Layer File provides, by file. */
  export interface LayerFileServices {
    readonly "server/db.layer.ts": import('effect').Layer.Layer.Success<typeof import("../server/db.layer").default>
    readonly "server/queries.layer.ts": import('effect').Layer.Layer.Success<typeof import("../server/queries.layer").default>
    readonly "server/token-secret.layer.ts": import('effect').Layer.Layer.Success<typeof import("../server/token-secret.layer").default>
  }
}
