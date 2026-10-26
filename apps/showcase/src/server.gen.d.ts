// Written by @sleekstack/ui-vite from the Server Service contracts, the Controllers, the RPC Files, and the Layer Files; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import('virtual:sleek/rpc').Tally | import('effect').Context.Tag.Identifier<(typeof import("./modules/users/domain/user").User)['adapter']>>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import('virtual:sleek/rpc').Tally>>
  export default services
}
declare module 'virtual:sleek/rpc' {
  export interface Tally {
    readonly 'virtual:sleek/rpc': "Tally"
  }
  export const Tally: import('effect').Context.Tag<Tally, import('@sleekstack/start').GeneratedServiceShape<{ readonly "add": typeof import("../server/routes/api/tally.controller")["POST"]; readonly "read": typeof import("../server/routes/api/tally.controller")["GET"] }>>
}
declare module 'virtual:sleek/server-app' {
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {
    readonly Tally: import('virtual:sleek/rpc').Tally
  }
}
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly "api/tally": "/api/tally"
    readonly "api/users/[id]": "/api/users/:id"
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly "api/tally": typeof import("../server/routes/api/tally.controller")
    readonly "api/users/[id]": typeof import("../server/routes/api/users/[id].controller")
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
declare module 'virtual:sleek/server-app' {
  /** What each Layer File provides, by file. */
  export interface LayerFileServices {
    readonly "server/tally.layer.ts": import('effect').Layer.Layer.Success<typeof import("../server/tally.layer").default>
    readonly "server/user.layer.ts": import('effect').Layer.Layer.Success<typeof import("../server/user.layer").default>
  }
}
