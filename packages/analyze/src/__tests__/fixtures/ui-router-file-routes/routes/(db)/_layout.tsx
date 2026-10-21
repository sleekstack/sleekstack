import type { Child } from '@sleekstack/ui'
import { Provider } from '@sleekstack/ui/jsx-runtime'
import { DbLive } from '../../tags'

// Provides Db around its pages, as the generated module renders them inside it: nothing is reported below.
export default (props: { children: Child }) => <Provider layer={DbLive}>{props.children}</Provider>
