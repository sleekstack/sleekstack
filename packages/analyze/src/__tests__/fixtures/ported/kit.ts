// Ported kit snapshot tests (see .flow/notes/fn-9-build-time-error-port-list.md).
import { effect, layer, module, tag } from '@sleekstack/kit'
const Log = tag<string>('Log')
const Db = tag<string>('Db')
const Out = tag<string>('Out')

// effect.test: graph rules apply to a kit effect()'s deps.
export const EffectApp = module({ name: 'EffectApp', provide: [effect(() => {}, [Log], { name: 'job' })] }) // @error MissingDependency

// privacy.test: omitted exports = all public; an outside provider may shadow a private Tag.
const Open = module({ name: 'Open', provide: [layer(Db, 'db')] })
export const OpenApp = module({ name: 'OpenApp', imports: [Open], provide: [layer(Out, (d) => d, [Db])] })
const Private = module({ name: 'Private', provide: [layer(Db, 'db')], exports: [] })
export const ShadowApp = module({ name: 'ShadowApp', imports: [Private], provide: [layer(Db, 'mine'), layer(Out, (d) => d, [Db])] })
