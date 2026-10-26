// Written by @sleekstack/ui-vite from the Server Service contracts, the Controllers, and the RPC Files; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import("./contract").Profiles | import('virtual:sleek/rpc').People>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import("./contract").Profiles | typeof import('virtual:sleek/rpc').People>>
  export default services
}
declare module 'virtual:sleek/rpc' {
  export interface People {
    readonly 'virtual:sleek/rpc': "People"
  }
  export const People: import('effect').Context.Tag<People, import('@sleekstack/start').GeneratedServiceShape<{ readonly "get": import('@sleekstack/start').ControllerMethodsOf<typeof import("../server/routes/users/[id].controller").default>["GET"]; readonly "rename": import('@sleekstack/start').ControllerMethodsOf<typeof import("../server/routes/users/[id].controller").default>["PUT"] }>>
}
declare module 'virtual:sleek/server-app' {
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {
    readonly People: import('virtual:sleek/rpc').People
  }
}
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly "users/[id]": "/users/:id"
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly "users/[id]": import('@sleekstack/start').ControllerMethodsOf<typeof import("../server/routes/users/[id].controller").default>
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
