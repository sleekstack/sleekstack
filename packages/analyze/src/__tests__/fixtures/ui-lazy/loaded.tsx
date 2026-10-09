import { Context } from 'effect'

export class Repo extends Context.Tag('Repo')<Repo, string>() {}

export default function* Loaded() {
  const repo = yield* Repo
  return <b>{repo}</b>
}
