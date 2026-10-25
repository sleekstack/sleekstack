// The sections the Vite plugin writes into `src/server.gen.d.ts` for the RPC Files, the Manifest, the Controllers and
// the Layer Files; do not edit. Its `virtual:sleek/server` and registry sections, which also list these Tags, are in
// the Server Services guide.
declare module 'virtual:sleek/rpc' {
  export interface NotesApi {
    readonly 'virtual:sleek/rpc': 'NotesApi'
  }
  export const NotesApi: import('effect').Context.Tag<
    NotesApi,
    import('@sleekstack/start').GeneratedServiceShape<Pick<typeof import('../server/notes-api.rpc'), 'add' | 'mine'>>
  >
  export interface NoteLookup {
    readonly 'virtual:sleek/rpc': 'NoteLookup'
  }
  export const NoteLookup: import('effect').Context.Tag<
    NoteLookup,
    import('@sleekstack/start').GeneratedServiceShape<{
      readonly find: (typeof import('../server/routes/notes/[id].controller'))['GET']
      readonly remove: (typeof import('../server/routes/notes/[id].controller'))['DELETE']
    }>
  >
}
declare module 'virtual:sleek/server-app' {
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {
    readonly NoteLookup: import('virtual:sleek/rpc').NoteLookup
    readonly NotesApi: import('virtual:sleek/rpc').NotesApi
  }
}
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly notes: '/notes'
    readonly 'notes/[id]': '/notes/:id'
    readonly 'notes/[id]/title': '/notes/:id/title'
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly notes: typeof import('../server/routes/notes.controller')
    readonly 'notes/[id]': typeof import('../server/routes/notes/[id].controller')
    readonly 'notes/[id]/title': import('@sleekstack/start').ControllerMethodsOf<
      typeof import('../server/routes/notes/[id]/title.controller').default
    >
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
declare module 'virtual:sleek/server-app' {
  /** What each Layer File provides, by file. */
  export interface LayerFileServices {
    readonly 'server/notes.layer.ts': import('effect').Layer.Layer.Success<typeof import('../server/notes.layer').default>
  }
}
