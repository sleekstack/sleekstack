// The discovered app's module, served by `serverServices()` from `@sleekstack/ui-vite`. The generated declaration
// merges into the interfaces, which are empty without it.
declare module 'virtual:sleek/server-app' {
  const app: import('./app').DiscoveredApp
  export default app
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {}
  /** What each Layer File provides, by its path from the app root. */
  export interface LayerFileServices {}
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {}
}
