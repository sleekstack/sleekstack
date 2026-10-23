// Written by @sleekstack/ui-vite from the Server Service contracts, the Controllers, and the Layer Files; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import("./contract").Profiles>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import("./contract").Profiles>>
  export default services
}
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly "api/hello": "/api/hello"
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly "api/hello": typeof import("../server/routes/api/hello.controller")
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
declare module 'virtual:sleek/server-app' {
  /** What each Layer File provides, by file. */
  export interface LayerFileServices {
    readonly "server/config.layer.ts": import('effect').Layer.Layer.Success<typeof import("../server/config.layer").default>
    readonly "server/db.layer.ts": import('effect').Layer.Layer.Success<typeof import("../server/db.layer").default>
    readonly "src/greeter.layer.ts": import('effect').Layer.Layer.Success<typeof import("./greeter.layer").default>
  }
}
