// Written by @sleekstack/ui-vite from the Server Service contracts; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import("./pages/tally").Tally>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntry<import("./pages/tally").Tally>>
  export default services
}
