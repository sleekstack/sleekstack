// Written by @sleekstack/ui-vite from the Server Service contracts; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import("./modules/identity/application/contracts").IdentityApi>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import("./modules/identity/application/contracts").IdentityApi>>
  export default services
}
