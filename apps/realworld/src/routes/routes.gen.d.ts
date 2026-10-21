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
    readonly "article/[slug]": "/article/:slug"
    readonly "(guarded)/editor/index": "/editor"
    readonly "(guarded)/editor/[slug]": "/editor/:slug"
    readonly "(guarded)/feed": "/feed"
    readonly "login": "/login"
    readonly "profile/[username]/index": "/profile/:username"
    readonly "profile/[username]/favorites": "/profile/:username/favorites"
    readonly "register": "/register"
    readonly "(guarded)/settings": "/settings"
    readonly "tag/[tag]": "/tag/:tag"
  }
  export const pages: {
    readonly "index": Page<typeof import("./index.tsx"), [typeof import("./_layout.tsx")]>
    readonly "article/[slug]": Page<typeof import("./article/[slug].tsx"), [typeof import("./_layout.tsx")]>
    readonly "(guarded)/editor/index": Page<typeof import("./(guarded)/editor/index.tsx"), [typeof import("./_layout.tsx"), typeof import("./(guarded)/_layout.tsx")]>
    readonly "(guarded)/editor/[slug]": Page<typeof import("./(guarded)/editor/[slug].tsx"), [typeof import("./_layout.tsx"), typeof import("./(guarded)/_layout.tsx")]>
    readonly "(guarded)/feed": Page<typeof import("./(guarded)/feed.tsx"), [typeof import("./_layout.tsx"), typeof import("./(guarded)/_layout.tsx")]>
    readonly "login": Page<typeof import("./login.tsx"), [typeof import("./_layout.tsx")]>
    readonly "profile/[username]/index": Page<typeof import("./profile/[username]/index.tsx"), [typeof import("./_layout.tsx")]>
    readonly "profile/[username]/favorites": Page<typeof import("./profile/[username]/favorites.tsx"), [typeof import("./_layout.tsx")]>
    readonly "register": Page<typeof import("./register.tsx"), [typeof import("./_layout.tsx")]>
    readonly "(guarded)/settings": Page<typeof import("./(guarded)/settings.tsx"), [typeof import("./_layout.tsx"), typeof import("./(guarded)/_layout.tsx")]>
    readonly "tag/[tag]": Page<typeof import("./tag/[tag].tsx"), [typeof import("./_layout.tsx")]>
  }
  export const notFound: Page<typeof import("./_notFound.tsx")>["render"]
}
