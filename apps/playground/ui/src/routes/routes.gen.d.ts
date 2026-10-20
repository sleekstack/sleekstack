// Written by @sleekstack/ui-vite from the route files in this directory; do not edit.
declare module 'virtual:sleekstack/routes' {
  type Render = () => import('@sleekstack/ui/jsx-runtime').JSX.Element
  type Page<M> = { readonly render: Render } & Pick<M, Extract<keyof M, "loaders" | "fallback" | "prerender">>
  export const table: {
    readonly "index": "/"
    readonly "users/[id]": "/users/:id"
  }
  export const pages: {
    readonly "index": Page<typeof import("./index.tsx")>
    readonly "users/[id]": Page<typeof import("./users/[id].tsx")>
  }
}
