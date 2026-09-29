import { tag } from '@sleekstack/kit'

export const Clock = tag<{ now(): number }>('Clock')
export const Logger = tag<{ log(): void }>('Logger')
export const Store = tag<object>('Store')
const key = 'TaskRepo'
export const Repos = { Task: tag<object>(key) } as const
