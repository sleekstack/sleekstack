/** @jsxImportSource @sleekstack/ui */
import type { Child } from '@sleekstack/ui'
import { signedIn } from '../../pages/loaders'

/** The pages only the signed-in user may see: `signedIn` sends anyone else to `/login`. */
export default function Guarded({ children }: { children?: Child }) {
  return <>{children}</>
}

export const loaders = [signedIn]
