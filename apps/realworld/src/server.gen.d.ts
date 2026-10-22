// Written by @sleekstack/ui-vite from the Server Service contracts and the Controllers; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import("./modules/identity/application/contracts").IdentityApi | import("./modules/articles/application/contracts").ArticlesApi | import("./modules/comments/application/contracts").CommentsApi>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import("./modules/identity/application/contracts").IdentityApi | typeof import("./modules/articles/application/contracts").ArticlesApi | typeof import("./modules/comments/application/contracts").CommentsApi>>
  export default services
}
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly "api/index": "/api"
    readonly "api/tags": "/api/tags"
    readonly "api/[...rest]": "/api/*rest"
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly "api/index": typeof import("../server/routes/api/index.controller")
    readonly "api/tags": typeof import("../server/routes/api/tags.controller")
    readonly "api/[...rest]": typeof import("../server/routes/api/[...rest].controller")
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
