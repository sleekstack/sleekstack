/** @jsxImportSource @sleekstack/ui */
import { mount } from '@sleekstack/ui'
import { Layer } from 'effect'

/** Size budget entry (ADR 0022): the smallest `mount` app. */
export const mountHello = (container: Element) => mount(<h1>Hello</h1>, { layer: Layer.empty, container })
