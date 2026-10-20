// Written by @sleekstack/ui-vite from the route files in this directory; do not edit.
declare module 'virtual:sleekstack/routes' {
  type Render = () => import('@sleekstack/ui/jsx-runtime').JSX.Element
  type Page<M> = { readonly render: Render } & Pick<M, Extract<keyof M, "loaders" | "fallback" | "prerender">>
  export const table: {
    readonly "index": "/"
    readonly "about": "/about"
    readonly "data": "/data"
    readonly "guest": "/guest"
    readonly "later": "/later"
  }
  export const pages: {
    readonly "index": Page<typeof import("./index.tsx")>
    readonly "about": Page<typeof import("./about.tsx")>
    readonly "data": Page<typeof import("./data.tsx")>
    readonly "guest": Page<typeof import("./guest.tsx")>
    readonly "later": Page<typeof import("./later.tsx")>
  }
  export const notFound: Page<typeof import("./_notFound.tsx")>["render"]
}
