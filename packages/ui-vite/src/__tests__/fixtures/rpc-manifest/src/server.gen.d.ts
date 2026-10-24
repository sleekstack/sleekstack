// Written by @sleekstack/ui-vite from the Server Service contracts, the Controllers, and the RPC Files; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import("./contract").Profiles | import('virtual:sleek/rpc').Notes>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import("./contract").Profiles | typeof import('virtual:sleek/rpc').Notes>>
  export default services
}
declare module 'virtual:sleek/rpc' {
  export interface Notes {
    readonly 'virtual:sleek/rpc': "Notes"
  }
  export const Notes: import('effect').Context.Tag<Notes, import('@sleekstack/start').GeneratedServiceShape<{ readonly "count": typeof import("../server/routes/api/count.controller")["GET"]; readonly "save": typeof import("../server/routes/api/notes/[id].controller")["PUT"] }>>
}
declare module 'virtual:sleek/server-app' {
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {
    readonly Notes: import('virtual:sleek/rpc').Notes
  }
}
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly "api/count": "/api/count"
    readonly "api/notes/[id]": "/api/notes/:id"
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly "api/count": typeof import("../server/routes/api/count.controller")
    readonly "api/notes/[id]": typeof import("../server/routes/api/notes/[id].controller")
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
