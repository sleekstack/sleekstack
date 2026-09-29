'use client'
import { useSyncExternalStore } from 'react'
import { useService } from '@sleekstack/kit/react'
import { Local, Shared } from './services'

export default function Counter({ label }: { readonly label: string }) {
  const [shared, local] = [useService(Shared), useService(Local)]
  const s = useSyncExternalStore(shared.subscribe, shared.get, shared.get)
  const l = useSyncExternalStore(local.subscribe, local.get, local.get)
  return <button type="button" onClick={() => (shared.bump(), local.bump())}>{`${label}: ${s} / ${l}`}</button>
}
