// The discovered app's module, served by `serverServices()` from `@sleekstack/ui-vite`.
declare module 'virtual:sleek/server-app' {
  const app: import('./app').DiscoveredApp
  export default app
}
