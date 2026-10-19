/// <reference types="vite/client" />

declare module 'virtual:sleek-content' {
  export const routes: Record<string, string>
  export const pages: Record<
    string,
    () => Promise<{ default: () => never; frontmatter: { title: string; description?: string } }>
  >
}

interface ImportMetaEnv {
  readonly VITE_DOCS_BASE: string
  readonly VITE_DOCS_SITE: string
}
