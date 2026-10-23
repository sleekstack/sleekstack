import { Context } from 'effect'

export class Users extends Context.Tag('Users')<Users, { readonly name: (id: number) => string }>() {}
export class Viewer extends Context.Tag('Viewer')<Viewer, { readonly id: string }>() {}
export class Audit extends Context.Tag('Audit')<Audit, { readonly log: (line: string) => void }>() {}
