/** @jsxImportSource @sleekstack/ui */
import { mount } from '@sleekstack/ui'
import { Layer } from 'effect'

declare const process: { readonly env: { readonly NODE_ENV?: string } }

/** Bundle test entry: an app that mounts the devtools panel only outside production, behind a dynamic import. */
export const openPanel = async (container: Element) => {
  if (process.env.NODE_ENV === 'production') return
  const { SleekStackDevtools } = await import('../../index')
  return mount(<SleekStackDevtools />, { layer: Layer.empty, container })
}
