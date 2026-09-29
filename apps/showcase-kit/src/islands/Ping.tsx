'use client'
import { useState } from 'react'
import { pingFromIsland } from './islands.actions'

/** Calls a kit `effect()` Server Action from inside an Island root. */
export default function Ping() {
  const [pings, setPings] = useState(0)
  const [status, setStatus] = useState('idle')
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setPings((n) => n + 1)
          const r = await pingFromIsland('island')
          setStatus(r.ok ? `ok ${r.data}` : `error ${r.error}`)
        }}
      >{`ping ${pings}`}</button>
      <output>{status}</output>
    </div>
  )
}
