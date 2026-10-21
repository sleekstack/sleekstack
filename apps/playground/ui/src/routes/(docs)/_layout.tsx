import type { Child } from '@sleekstack/ui/jsx-runtime'

// A `(group)` adds no path segment; its layout wraps only the pages inside it, within the root layout.
export default function Docs({ children }: { children: Child }) {
  return <article>{children}</article>
}
