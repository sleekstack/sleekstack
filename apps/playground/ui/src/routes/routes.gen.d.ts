// Written by @sleekstack/ui-vite from the route files in this directory; do not edit.
declare module 'virtual:sleekstack/routes' {
  type Render = () => import('@sleekstack/ui/jsx-runtime').JSX.Element
  type LoadersOf<M> = M extends { readonly loaders: ReadonlyArray<infer L> } ? L : never
  type WithLayouts<M, L extends readonly unknown[]> = [L[number]] extends [never]
    ? M
    : [LoadersOf<M | L[number]>] extends [never]
      ? M
      : Omit<M, "loaders"> & { readonly loaders: ReadonlyArray<LoadersOf<M | L[number]>> }
  type Page<M, L extends readonly unknown[] = []> = { readonly render: Render; readonly load?: () => Promise<unknown> } & Pick<
    WithLayouts<M, L>,
    Extract<keyof WithLayouts<M, L>, "loaders" | "fallback" | "prerender">
  >
  export const table: {
    readonly "index": "/"
    readonly "users/[id]": "/users/:id"
  }
  export const pages: {
    readonly "index": Page<typeof import("./index.tsx")>
    readonly "users/[id]": Page<typeof import("./users/[id].tsx")>
  }
}
