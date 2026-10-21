// What the Vite plugin writes beside the app (`src/server.gen.d.ts`) from the contracts; do not edit.
declare module 'virtual:sleek/server' {
  const layer: import('effect').Layer.Layer<import('./profiles').Profiles>
  export default layer
}
declare module 'virtual:sleek/server-registry' {
  const services: ReadonlyArray<import('@sleekstack/start/client').ServerServiceEntryOf<typeof import('./profiles').Profiles>>
  export default services
}
