// Written by @sleekstack/ui-vite from the route files in this directory; do not edit.
declare module 'virtual:sleekstack/routes' {
  export const table: {
    readonly "index": "/"
    readonly "users/[id]": "/users/:id"
  }
  export const pages: {
    readonly "index": typeof import("./index.tsx").default
    readonly "users/[id]": typeof import("./users/[id].tsx").default
  }
}
