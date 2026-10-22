// The Controllers section the Vite plugin writes into `src/server.gen.d.ts`, after the Server Services one; do not edit.
declare module 'virtual:sleek/server-app' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {
    readonly notes: '/notes'
    readonly 'notes/[id]': '/notes/:id'
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {
    readonly notes: typeof import('../server/routes/notes.controller')
    readonly 'notes/[id]': typeof import('../server/routes/notes/[id].controller')
  }
  /** Whether a discovered Controller's pattern matches `pathname`, so a dev server forwards it to `start`. */
  export const isControllerPath: (pathname: string) => boolean
}
