import { Context, Layer, Schema } from 'effect'
import { loader } from '@sleekstack/router'

export class Repo extends Context.Tag('Repo')<Repo, string>() {}
export class Db extends Context.Tag('Db')<Db, string>() {}

export const RepoLive = Layer.succeed(Repo, 'r')
export const DbLive = Layer.succeed(Db, 'd')
export const item = loader('item', Schema.String, Db)
