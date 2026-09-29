'use client'
import { defineIslands } from '@sleekstack/islands'
import { SharedTallyLayer } from './services'

export const Island = defineIslands(
  {
    counter: () => import('./Counter'),
    controls: () => import('./Controls'),
    shared: () => import('./Shared'),
    ping: () => import('./Ping'),
    ided: () => import('./Ided'),
  },
  { provide: [SharedTallyLayer] },
)
