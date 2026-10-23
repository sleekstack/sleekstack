// Written by @sleekstack/ui-vite from the Server Service contracts and the Controllers; do not edit.
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
    readonly "users/[id]": "/users/:id"
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly "users/[id]": typeof import("../server/routes/users/[id].controller")
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
