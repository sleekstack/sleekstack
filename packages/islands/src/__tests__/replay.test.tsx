import { afterEach, describe, expect, it, vi } from 'vitest'
import { replayClick, shouldReplay } from '../replay'

afterEach(() => {
  document.body.innerHTML = ''
})

const setup = (html: string) => {
  const c = document.createElement('div')
  c.innerHTML = html
  document.body.append(c)
  return { c, t: c.querySelector('#t')! }
}

describe('shouldReplay', () => {
  it.each([
    ['plain button', '<button id="t" type="button">x</button>', true],
    ['untyped button outside a form', '<button id="t">x</button>', true],
    ['div', '<div id="t">x</div>', true],
    ['link', '<a id="t" href="/x">x</a>', false],
    ['span inside a link', '<a href="/x"><span id="t">x</span></a>', false],
    ['checkbox', '<input id="t" type="checkbox">', false],
    ['radio', '<input id="t" type="radio">', false],
    ['label', '<label id="t">x</label>', false],
    ['summary', '<details><summary id="t">x</summary></details>', false],
    ['submit button', '<form><button id="t">x</button></form>', false],
    ['submit input', '<form><input id="t" type="submit"></form>', false],
    ['type=button in a form', '<form><button id="t" type="button">x</button></form>', true],
  ])('%s -> %s', (_, html, expected) => {
    const { c, t } = setup(html)
    expect(shouldReplay(c, t)).toBe(expected)
  })

  it('link outside the container does not block replay', () => {
    document.body.innerHTML = '<a href="/x"><div id="c"><button id="t" type="button">x</button></div></a>'
    expect(shouldReplay(document.getElementById('c')!, document.getElementById('t'))).toBe(true)
  })
})

describe('replayClick', () => {
  it('re-dispatches a bubbling click clone on the original target', () => {
    const { c, t } = setup('<button id="t" type="button">x</button>')
    const seen = vi.fn()
    c.addEventListener('click', (e) => seen(e.target, e.bubbles))
    const original = new MouseEvent('click', { bubbles: true, clientX: 7 })
    t.dispatchEvent(original)
    seen.mockClear()
    replayClick(c, original)
    expect(seen).toHaveBeenCalledExactlyOnceWith(t, true)
  })

  it('drops a detached target silently', () => {
    const { c, t } = setup('<button id="t" type="button">x</button>')
    const original = new MouseEvent('click', { bubbles: true })
    t.dispatchEvent(original)
    const seen = vi.fn()
    t.addEventListener('click', seen)
    t.remove()
    expect(() => replayClick(c, original)).not.toThrow()
    expect(seen).not.toHaveBeenCalled()
  })
})
