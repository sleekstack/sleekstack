declare module 'virtual:sleek/rpc' {
  export interface Notes {
    readonly 'virtual:sleek/rpc': 'Notes'
  }
  export const Notes: import('effect').Context.Tag<Notes, { readonly count: () => import('effect').Effect.Effect<number> }>
}
