// Written by @sleekstack/ui-vite from the Server Service contracts and the RPC Files; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import("./contract").Profiles | import('virtual:sleek/rpc').Comments>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import("./contract").Profiles | typeof import('virtual:sleek/rpc').Comments>>
  export default services
}
declare module 'virtual:sleek/rpc' {
  export interface Comments {
    readonly 'virtual:sleek/rpc': "Comments"
  }
  export const Comments: import('effect').Context.Tag<Comments, import('@sleekstack/start').GeneratedServiceShape<Pick<typeof import("../server/comments.rpc"), "add" | "delete" | "list">>>
}
declare module 'virtual:sleek/server-app' {
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {
    readonly Comments: import('virtual:sleek/rpc').Comments
  }
}
