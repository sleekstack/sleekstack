import { SleekStackError, type SleekStackErrorCode } from '@sleekstack/kit'

// Exhaustive over every code: a new code fails this file's typecheck.
const hints: Record<SleekStackErrorCode, string> = {
  MissingDependency: 'provide the missing Tag',
  DependencyCycle: 'break the cycle in details.path',
  AmbiguousProvider: 'remove one provider, or move one to a more local position',
  ModuleCycle: 'remove one import, extract the shared Tags into a third module, or merge them',
  DuplicateModule: 'rename one of the modules',
  InvalidModule: 'check the module config',
  CaptiveDependency: 'shorten the dependent lifetime or lengthen the dependency',
  PrivateDependency: 'export the Tag from its module',
  DuplicateTag: 'reuse one tag() object for the key',
  InvalidTag: 'pass tag() or a named class',
  LayerFailed: 'see details.cause for the factory error',
  CleanupFailed: 'see details.tag for the failed cleanup',
  HandlerFailed: 'the action handler threw',
  Unknown: 'see error.cause',
}

export function explain(e: unknown): string {
  if (e instanceof SleekStackError) return `${e.code}: ${e.message} (${hints[e.code]})`
  return String(e)
}
