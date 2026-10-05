import { prefetchAtoms } from '@sleekstack/next'
import { LayerProvider } from '@sleekstack/react'
import { Atom } from '@sleekstack/core'
import { Schema } from 'effect'

type Snapshot = Awaited<ReturnType<typeof prefetchAtoms>>
const serverTime = Atom.serializable(Atom.make(Date.now()), { key: 'app/serverTime', schema: Schema.Number })
const greeting = Atom.serializable(Atom.make('hello'), { key: 'app/greeting', schema: Schema.String })
declare const app: Parameters<typeof LayerProvider>[0]['provide'] extends readonly (infer L)[] | undefined ? L : never
declare const Readers: () => null

// app/atoms/page.tsx (server component)
export default async function Page() {
  const snapshot = await prefetchAtoms([serverTime, greeting]) // serializable atoms only
  return <Client snapshot={snapshot} />
}

// Client.tsx ('use client' in its own file in a real app)
export function Client({ snapshot }: { snapshot: Snapshot }) {
  return (
    <LayerProvider provide={[app]} hydrate={snapshot}>
      <Readers />
    </LayerProvider>
  )
}
