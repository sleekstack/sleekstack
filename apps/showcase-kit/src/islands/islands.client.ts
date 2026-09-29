'use client'
import { defineIslands } from '@sleekstack/islands'

export const Island = defineIslands({ counter: () => import('./Counter') })
