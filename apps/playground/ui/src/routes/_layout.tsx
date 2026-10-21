import type { Child } from '@sleekstack/ui/jsx-runtime'

// Wraps every page (not the not-found page); it remounts on each navigation, as the router swaps the whole page.
export default function Shell({ children }: { children: Child }) {
  return (
    <>
      <nav>
        <a href="/">Home</a> <a href="/users/42">User 42</a> <a href="/posts">Posts</a> <a href="/guide/intro">Guide</a>
      </nav>
      {children}
    </>
  )
}
