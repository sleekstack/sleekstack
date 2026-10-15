// Plain React: guests run under their own react-dom and receive no Effect context.
import { fromReact } from '@sleekstack/ui'

const AvatarView = ({ name }: { name: string }) => (
  <span className="avatar" title={name}>
    {name.slice(0, 1)}
  </span>
)
export const Avatar = fromReact(AvatarView)
