/** @jsxImportSource @sleekstack/ui */
import { useLocal } from '@sleekstack/ui'
import { containsUrl, type NavNode } from './nav'

interface NodeProps {
  readonly node: NavNode
  readonly current: string
  readonly onNavigate: () => void
}

const Link = ({
  title,
  url,
  current,
  onNavigate,
}: {
  title: string
  url: string
  current: string
  onNavigate: () => void
}) => (
  <a href={url} aria-current={url === current ? 'page' : undefined} onClick={onNavigate}>
    {title}
  </a>
)

/** A folder opens when it holds the current page; its toggle collapses it. */
const Folder = function* ({ node, current, onNavigate }: NodeProps & { node: Extract<NavNode, { type: 'folder' }> }) {
  const [open, setOpen] = yield* useLocal(containsUrl(node, current))
  return (
    <li class="folder">
      <div class="folder-head">
        {node.url ? (
          <Link title={node.title} url={node.url} current={current} onNavigate={onNavigate} />
        ) : (
          <span>{node.title}</span>
        )}
        <button
          type="button"
          aria-expanded={open ? 'true' : 'false'}
          aria-label={`Toggle ${node.title}`}
          onClick={() => setOpen((o) => !o)}
        />
      </div>
      {open && <Nodes nodes={node.children} current={current} onNavigate={onNavigate} />}
    </li>
  )
}

const Nodes = ({
  nodes,
  current,
  onNavigate,
}: {
  nodes: ReadonlyArray<NavNode>
  current: string
  onNavigate: () => void
}) => (
  <ul>
    {nodes.map((node) =>
      node.type === 'page' ? (
        <li key={node.url}>
          <Link title={node.title} url={node.url} current={current} onNavigate={onNavigate} />
        </li>
      ) : (
        <Folder key={node.title} node={node} current={current} onNavigate={onNavigate} />
      ),
    )}
  </ul>
)

/** The sidebar; below the breakpoint it is a drawer that `open` slides in (the stylesheet decides). */
export const Sidebar = ({
  tree,
  current,
  open,
  onNavigate,
}: {
  tree: ReadonlyArray<NavNode>
  current: string
  open: boolean
  onNavigate: () => void
}) => (
  <nav class={open ? 'sidebar open' : 'sidebar'} aria-label="Documentation">
    <Nodes nodes={tree} current={current} onNavigate={onNavigate} />
  </nav>
)
