// Written by @sleekstack/ui-vite from the route files in this directory; do not edit.
declare module 'virtual:sleekstack/routes' {
  type Render = () => import('@sleekstack/ui/jsx-runtime').JSX.Element
  type LoadersOf<M> = M extends { readonly loaders: ReadonlyArray<infer L> } ? L : never
  type WithLayouts<M, L extends readonly unknown[]> = [L[number]] extends [never]
    ? M
    : [LoadersOf<M | L[number]>] extends [never]
      ? M
      : Omit<M, "loaders"> & { readonly loaders: ReadonlyArray<LoadersOf<M | L[number]>> }
  type Page<M, L extends readonly unknown[] = []> = { readonly render: Render } & Pick<
    WithLayouts<M, L>,
    Extract<keyof WithLayouts<M, L>, "loaders" | "fallback" | "prerender">
  >
  export const table: {
    readonly "index": "/"
    readonly "about": "/about"
    readonly "(shop)/cart": "/cart"
    readonly "data": "/data"
    readonly "guest": "/guest"
    readonly "later": "/later"
  }
  export const pages: {
    readonly "index": Page<typeof import("./index.tsx"), [typeof import("./_layout.tsx")]>
    readonly "about": Page<typeof import("./about.tsx"), [typeof import("./_layout.tsx")]>
    readonly "(shop)/cart": Page<typeof import("./(shop)/cart.tsx"), [typeof import("./_layout.tsx"), typeof import("./(shop)/_layout.tsx")]>
    readonly "data": Page<typeof import("./data.tsx"), [typeof import("./_layout.tsx")]>
    readonly "guest": Page<typeof import("./guest.tsx"), [typeof import("./_layout.tsx")]>
    readonly "later": Page<typeof import("./later.tsx"), [typeof import("./_layout.tsx")]>
  }
  export const notFound: Page<typeof import("./_notFound.tsx")>["render"]
}
