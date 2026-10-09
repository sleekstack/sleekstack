import type { Atom } from '@sleekstack/core'
import type { Child } from './jsx-runtime'
import type { Ref } from './node'

type Prim = string | number | boolean
/** An attribute value: a primitive, `null`/`undefined` (attribute removed), or an atom of those (bound attribute). */
export type AttrValue<T extends Prim = Prim> = T | null | undefined | Atom.Atom<T | null | undefined>
type V<T extends Prim = Prim> = AttrValue<T>

/** `class` is canonical; `className` is accepted, never both. */
type ClassAttr = { class?: V; className?: never } | { className?: V; class?: never }
/** `for` is canonical; `htmlFor` is accepted, never both. */
type ForAttr = { for?: V; htmlFor?: never } | { htmlFor?: V; for?: never }

interface GlobalAttrs {
  // Events and refs are typed per element in a later step; any `on*` value reaches the runtime as today.
  [event: `on${string}`]: unknown
  [aria: `aria-${string}`]: V
  [data: `data-${string}`]: V
  children?: Child
  key?: string | number
  ref?: Ref<any>
  accesskey?: V<string>
  autocapitalize?: V<string>
  autofocus?: V<boolean>
  contenteditable?: V<boolean | 'true' | 'false' | 'plaintext-only'>
  dir?: V<'ltr' | 'rtl' | 'auto'>
  draggable?: V<boolean | 'true' | 'false'>
  enterkeyhint?: V<string>
  hidden?: V<boolean | 'until-found'>
  id?: V<string>
  inert?: V<boolean>
  inputmode?: V<string>
  is?: V<string>
  lang?: V<string>
  nonce?: V<string>
  part?: V<string>
  popover?: V<boolean | 'auto' | 'manual' | 'hint'>
  role?: V<string>
  slot?: V<string>
  spellcheck?: V<boolean | 'true' | 'false'>
  style?: V<string>
  tabindex?: V<number | string>
  title?: V<string>
  translate?: V<'yes' | 'no'>
}

type CrossOrigin = V<'' | 'anonymous' | 'use-credentials'>
type Target = V<string>
type InputType =
  | 'button'
  | 'checkbox'
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'image'
  | 'month'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'reset'
  | 'search'
  | 'submit'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week'
type FormControl = { disabled?: V<boolean>; form?: V<string>; name?: V<string> }
type Media = {
  autoplay?: V<boolean>
  controls?: V<boolean>
  crossorigin?: CrossOrigin
  loop?: V<boolean>
  muted?: V<boolean>
  preload?: V<'' | 'none' | 'metadata' | 'auto'>
  src?: V<string>
}
type Cell = { colspan?: V<number | string>; rowspan?: V<number | string>; headers?: V<string> }

/** Per-tag attributes (HTML attribute names, not DOM property names). Tags not listed take the global attributes only. */
interface HtmlAttrs {
  a: {
    download?: V
    href?: V<string>
    hreflang?: V<string>
    ping?: V<string>
    referrerpolicy?: V<string>
    rel?: V<string>
    target?: Target
    type?: V<string>
  }
  area: {
    alt?: V<string>
    coords?: V<string>
    download?: V
    href?: V<string>
    rel?: V<string>
    shape?: V<string>
    target?: Target
  }
  audio: Media
  base: { href?: V<string>; target?: Target }
  blockquote: { cite?: V<string> }
  button: FormControl & {
    formaction?: V<string>
    formenctype?: V<string>
    formmethod?: V<string>
    formnovalidate?: V<boolean>
    formtarget?: Target
    popovertarget?: V<string>
    popovertargetaction?: V<'hide' | 'show' | 'toggle'>
    type?: V<'submit' | 'reset' | 'button'>
    value?: V<string | number>
  }
  canvas: { height?: V<number | string>; width?: V<number | string> }
  col: { span?: V<number | string> }
  colgroup: { span?: V<number | string> }
  data: { value?: V<string | number> }
  del: { cite?: V<string>; datetime?: V<string> }
  details: { name?: V<string>; open?: V<boolean> }
  dialog: { open?: V<boolean> }
  embed: { height?: V<number | string>; src?: V<string>; type?: V<string>; width?: V<number | string> }
  fieldset: FormControl
  form: {
    'accept-charset'?: V<string>
    action?: V<string>
    autocomplete?: V<'on' | 'off'>
    enctype?: V<string>
    method?: V<'get' | 'post' | 'dialog'>
    name?: V<string>
    novalidate?: V<boolean>
    rel?: V<string>
    target?: Target
  }
  iframe: {
    allow?: V<string>
    allowfullscreen?: V<boolean>
    height?: V<number | string>
    loading?: V<'eager' | 'lazy'>
    name?: V<string>
    referrerpolicy?: V<string>
    sandbox?: V<string>
    src?: V<string>
    srcdoc?: V<string>
    width?: V<number | string>
  }
  img: {
    alt?: V<string>
    crossorigin?: CrossOrigin
    decoding?: V<'sync' | 'async' | 'auto'>
    fetchpriority?: V<'high' | 'low' | 'auto'>
    height?: V<number | string>
    ismap?: V<boolean>
    loading?: V<'eager' | 'lazy'>
    referrerpolicy?: V<string>
    sizes?: V<string>
    src?: V<string>
    srcset?: V<string>
    usemap?: V<string>
    width?: V<number | string>
  }
  input: FormControl & {
    accept?: V<string>
    alt?: V<string>
    autocomplete?: V<string>
    capture?: V<string>
    checked?: V<boolean>
    dirname?: V<string>
    formaction?: V<string>
    formenctype?: V<string>
    formmethod?: V<string>
    formnovalidate?: V<boolean>
    formtarget?: Target
    height?: V<number | string>
    list?: V<string>
    max?: V<number | string>
    maxlength?: V<number | string>
    min?: V<number | string>
    minlength?: V<number | string>
    multiple?: V<boolean>
    pattern?: V<string>
    placeholder?: V<string>
    popovertarget?: V<string>
    readonly?: V<boolean>
    required?: V<boolean>
    size?: V<number | string>
    src?: V<string>
    step?: V<number | string>
    type?: V<InputType>
    value?: V<string | number>
    width?: V<number | string>
  }
  ins: { cite?: V<string>; datetime?: V<string> }
  label: {}
  li: { value?: V<number | string> }
  link: {
    as?: V<string>
    crossorigin?: CrossOrigin
    fetchpriority?: V<'high' | 'low' | 'auto'>
    href?: V<string>
    hreflang?: V<string>
    integrity?: V<string>
    media?: V<string>
    referrerpolicy?: V<string>
    rel?: V<string>
    sizes?: V<string>
    type?: V<string>
  }
  map: { name?: V<string> }
  meta: {
    charset?: V<string>
    content?: V<string>
    'http-equiv'?: V<string>
    media?: V<string>
    name?: V<string>
    property?: V<string>
  }
  meter: {
    high?: V<number>
    low?: V<number>
    max?: V<number>
    min?: V<number>
    optimum?: V<number>
    value?: V<number | string>
  }
  object: {
    data?: V<string>
    form?: V<string>
    height?: V<number | string>
    name?: V<string>
    type?: V<string>
    width?: V<number | string>
  }
  ol: { reversed?: V<boolean>; start?: V<number | string>; type?: V<'1' | 'a' | 'A' | 'i' | 'I'> }
  optgroup: { disabled?: V<boolean>; label?: V<string> }
  option: { disabled?: V<boolean>; label?: V<string>; selected?: V<boolean>; value?: V<string | number> }
  output: FormControl
  progress: { max?: V<number | string>; value?: V<number | string> }
  q: { cite?: V<string> }
  script: {
    async?: V<boolean>
    crossorigin?: CrossOrigin
    defer?: V<boolean>
    integrity?: V<string>
    nomodule?: V<boolean>
    referrerpolicy?: V<string>
    src?: V<string>
    type?: V<string>
  }
  select: FormControl & {
    autocomplete?: V<string>
    multiple?: V<boolean>
    required?: V<boolean>
    size?: V<number | string>
    value?: V<string | number>
  }
  slot: { name?: V<string> }
  source: {
    height?: V<number | string>
    media?: V<string>
    sizes?: V<string>
    src?: V<string>
    srcset?: V<string>
    type?: V<string>
    width?: V<number | string>
  }
  style: { media?: V<string> }
  td: Cell
  textarea: FormControl & {
    autocomplete?: V<string>
    cols?: V<number | string>
    dirname?: V<string>
    maxlength?: V<number | string>
    minlength?: V<number | string>
    placeholder?: V<string>
    readonly?: V<boolean>
    required?: V<boolean>
    rows?: V<number | string>
    value?: V<string | number>
    wrap?: V<'hard' | 'soft' | 'off'>
  }
  th: Cell & { abbr?: V<string>; scope?: V<'row' | 'col' | 'rowgroup' | 'colgroup'> }
  time: { datetime?: V<string> }
  track: { default?: V<boolean>; kind?: V<string>; label?: V<string>; src?: V<string>; srclang?: V<string> }
  video: Media & {
    height?: V<number | string>
    playsinline?: V<boolean>
    poster?: V<string>
    width?: V<number | string>
  }
}

/** Presentation and geometry attributes shared by every SVG-only tag. */
type SvgAttrs = {
  [
    K in
      | 'clip-path'
      | 'clip-rule'
      | 'clipPathUnits'
      | 'color'
      | 'cx'
      | 'cy'
      | 'd'
      | 'dominant-baseline'
      | 'dx'
      | 'dy'
      | 'fill'
      | 'fill-opacity'
      | 'fill-rule'
      | 'filter'
      | 'font-family'
      | 'font-size'
      | 'font-weight'
      | 'fr'
      | 'fx'
      | 'fy'
      | 'gradientTransform'
      | 'gradientUnits'
      | 'height'
      | 'href'
      | 'in'
      | 'in2'
      | 'marker-end'
      | 'marker-mid'
      | 'marker-start'
      | 'markerHeight'
      | 'markerUnits'
      | 'markerWidth'
      | 'mask'
      | 'maskUnits'
      | 'offset'
      | 'opacity'
      | 'orient'
      | 'pathLength'
      | 'patternTransform'
      | 'patternUnits'
      | 'points'
      | 'preserveAspectRatio'
      | 'r'
      | 'refX'
      | 'refY'
      | 'result'
      | 'rx'
      | 'ry'
      | 'shape-rendering'
      | 'stdDeviation'
      | 'stop-color'
      | 'stop-opacity'
      | 'stroke'
      | 'stroke-dasharray'
      | 'stroke-dashoffset'
      | 'stroke-linecap'
      | 'stroke-linejoin'
      | 'stroke-miterlimit'
      | 'stroke-opacity'
      | 'stroke-width'
      | 'text-anchor'
      | 'textLength'
      | 'transform'
      | 'transform-origin'
      | 'vector-effect'
      | 'viewBox'
      | 'visibility'
      | 'width'
      | 'x'
      | 'x1'
      | 'x2'
      | 'xmlns'
      | 'xmlns:xlink'
      | 'xlink:href'
      | 'y'
      | 'y1'
      | 'y2'
  ]?: V
}

type ForTags = 'label' | 'output'
type HtmlTag = keyof HTMLElementTagNameMap
type SvgOnlyTag = Exclude<keyof SVGElementTagNameMap, HtmlTag>

type HtmlProps<T extends HtmlTag> = GlobalAttrs &
  (T extends keyof HtmlAttrs ? HtmlAttrs[T] : {}) &
  ClassAttr &
  (T extends ForTags ? ForAttr : {})

/** `JSX.IntrinsicElements`: HTML tags (shared HTML/SVG names resolve to HTML), SVG-only tags, and any hyphenated custom-element tag. */
export type IntrinsicElementMap = { [T in HtmlTag]: HtmlProps<T> } & {
  [T in SvgOnlyTag]: GlobalAttrs & SvgAttrs & ClassAttr
} & {
  [custom: `${string}-${string}`]: Record<string, unknown>
}
