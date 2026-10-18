/** @jsxImportSource @sleekstack/ui */
import { neighbours, type NavNode } from './nav'

/** Links to the previous and next page in sidebar order. */
export const PageFooter = ({ tree, current }: { tree: ReadonlyArray<NavNode>; current: string }) => {
  const { prev, next } = neighbours(tree, current)
  return (
    <footer class="page-footer">
      {prev ? (
        <a rel="prev" href={prev.url}>
          <small>Previous</small>
          {prev.title}
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a rel="next" href={next.url}>
          <small>Next</small>
          {next.title}
        </a>
      )}
    </footer>
  )
}
