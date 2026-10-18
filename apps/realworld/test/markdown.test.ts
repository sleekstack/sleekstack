// @vitest-environment jsdom
import { renderToString } from '@sleekstack/ui'
import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { markdown } from '../src/modules/articles/presentation/markdown'

const html = (source: string) => renderToString(markdown(source), { layer: Layer.empty })
/** The rendered body as a DOM, so tests read structure, not exact markup. */
const dom = async (source: string) => {
  const body = document.createElement('div')
  body.innerHTML = await html(source)
  return body
}

describe('markdown', () => {
  it('shows HTML in the body as text', async () => {
    const body = await dom('<script>alert(1)</script> <img src=x onerror=alert(1)>')
    expect([body.querySelectorAll('script, img').length, body.textContent]).toEqual([
      0,
      '<script>alert(1)</script> <img src=x onerror=alert(1)>',
    ])
  })

  it.each([
    ['javascript:alert%281%29'],
    ['JavaScript:alert%281%29'],
    ['java\tscript:alert%281%29'],
    ['data:text/html,x'],
  ])('neutralizes a %j link: its label stays, as text', async (href) => {
    const body = await dom(`[click](${href})`)
    expect([body.querySelector('a'), body.textContent]).toEqual([
      null,
      href.includes('\t') ? `[click](${href})` : 'click',
    ])
  })

  it('keeps safe links', async () => {
    const body = await dom('[a](https://x.io) [b](/article/x) [c](mailto:a@x.io)')
    expect([...body.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      'https://x.io',
      '/article/x',
      'mailto:a@x.io',
    ])
  })

  it('nests emphasis in strong and strong in emphasis', async () => {
    const body = await dom('**bold *em* bold** and *em **strong** em* and snake_case_name and _u_')
    expect([
      body.querySelector('strong > em')?.textContent,
      body.querySelector('em > strong')?.textContent,
      body.textContent,
    ]).toEqual(['em', 'strong', 'bold em bold and em strong em and snake_case_name and u'])
  })

  it('renders headings, paragraphs, code and lists', async () => {
    const body = await dom('# Title\n\nOne\nline\n\n```\n<b>x</b>\n```\n\n- a\n- `b`\n\n1. one\n2. two')
    expect([...body.children].map((e) => e.tagName)).toEqual(['H1', 'P', 'PRE', 'UL', 'OL'])
    expect([body.querySelector('pre code')!.textContent, body.querySelectorAll('li code').length]).toEqual([
      '<b>x</b>',
      1,
    ])
  })

  it.each([['['], ['[a]('], ['**a *'], ['`'], ['_a ']])('stays fast on a long run of unmatched %j', async (bit) => {
    const start = performance.now()
    await html(bit.repeat(100_000 / bit.length))
    expect(performance.now() - start).toBeLessThan(1_000)
  })

  it('renders an empty body as nothing', async () => {
    expect((await dom('')).childElementCount).toBe(0)
    expect((await dom('  \n\n')).textContent).toBe('')
  })
})
