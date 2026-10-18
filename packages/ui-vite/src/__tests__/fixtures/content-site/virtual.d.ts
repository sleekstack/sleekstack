declare module 'virtual:sleek-content' {
  export const routes: Record<string, string>
  export const pages: Record<string, () => Promise<{ default: () => never; frontmatter: { title: string; description?: string } }>>
}
