/** @jsxImportSource .. */
import { Atom } from '@sleekstack/core'
import type { Effect } from 'effect'
import { defineHandler } from '../handler'
import type { Ref } from '../node'

declare const label: Atom.Atom<string>
declare const count: Atom.Atom<number>
declare const on: Atom.Atom<boolean | null>

// R1: known attributes with the right value types pass; a misspelled one or a wrong value type fails
void (<input type="checkbox" checked name="n" />)
// @ts-expect-error misspelled attribute
void (<input chekced />)
// @ts-expect-error not an input type
void (<input type="banana" />)
// @ts-expect-error an object is not an attribute value
void (<div id={{}} />)

// R2, R15: class / className and for / htmlFor are each accepted, never both
void (<div class="a" />)
void (<div className="a" />)
void (<label for="x" />)
void (<label htmlFor="x" />)
// @ts-expect-error class and className together
void (<div class="a" className="b" />)
// @ts-expect-error for and htmlFor together
void (<label for="x" htmlFor="x" />)

// R6: aria-* and data-* on every element, HTML and SVG
void (<span aria-label="l" aria-hidden data-id={1} />)
void (<circle aria-hidden="true" data-x="y" r={2} />)

// R10: atoms, numbers, booleans, null and undefined
void (<div title={label} tabindex={count} hidden={on} id={null} lang={undefined} />)
void (<input value={3} disabled={false} />)

// R13: `a` is in both maps and resolves to HTML (`target` is HTML-only); SVG-only tags take SVG attributes
void (<a href="/" target="_blank" />)
void (
  <svg viewBox="0 0 1 1">
    <path d="M0 0" stroke-width={2} />
  </svg>
)
// @ts-expect-error SVG-only attribute on the HTML `a`
void (<a viewBox="0 0 1 1" />)

// R14: a hyphenated tag takes any props
void (<my-widget anything={{ x: 1 }} flag />)

// R1 on SVG: geometry attributes are per tag
// @ts-expect-error `cx` is a circle attribute, not a path one
void (<path cx={1} />)
// @ts-expect-error `d` is a path attribute, not a circle one
void (<circle d="M0 0" />)

// R1: shared attribute groups land where the platform has them, and nowhere else
void (<input type="button" popovertarget="p" popovertargetaction="show" />)
// @ts-expect-error `output` has no `disabled`
void (<output disabled />)

// R3: the handler gets the real event with currentTarget narrowed; multi-word events map back to their map key
void (<input onInput={(e) => void e.currentTarget.value} />)
void (<div onPointerDown={(e) => void e.pointerId} onKeyDown={(e) => void e.key} />)
void (<circle onClick={(e) => void e.currentTarget.r} />)
// @ts-expect-error a div has no value
void (<div onClick={(e) => void e.currentTarget.value} />)
// @ts-expect-error a MouseEvent has no key
void (<div onClick={(e) => void e.key} />)

// R4, R11: function, generator, Effect and defineHandler values, with open error and requirement types
declare const failing: Effect.Effect<void, Error, { readonly svc: true }>
const saved = defineHandler('t.saved', () => failing)
void (<button onClick={() => failing} />)
void (<button onClick={function* () {}} />)
void (<button onClick={failing} />)
void (<button onClick={saved} />)
void (<button onFocus={() => failing} />)
// @ts-expect-error a defineHandler value on a non-bubbling event
void (<button onFocus={saved} />)
void (<div onWebkitAnimationEnd={(e) => void e.type} />)

// R5: ref takes the matching useRef box only
declare const inputRef: Ref<HTMLInputElement>
void (<input ref={inputRef} />)
// @ts-expect-error a div box on an input
void (<div ref={inputRef} />)

// R12: inline handler strings are not supported
// @ts-expect-error string on an on* prop
void (<button onClick="go()" />)

// fn-46 R1: a form action gets the submit snapshot with formData; a string stays a URL
void (<form action={(e) => void e.formData.get('title')} />)
void (<form action="/save" />)
// @ts-expect-error a number is neither a URL nor an action
void (<form action={1} />)
