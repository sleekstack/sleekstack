/** Shared by the per-library implementations of the table. */
export interface Row {
  readonly id: number
  readonly label: string
}

export const tick = () => new Promise((r) => setTimeout(r, 0))

/** One mounted table. Every operation returns once the DOM is committed. */
export interface App {
  container: Element
  set(rows: ReadonlyArray<Row>): Promise<void>
  get(): ReadonlyArray<Row>
  click(rowIndex: number, cell: 2 | 3): Promise<void>
  /** Detaches what the table attached to the document. */
  dispose?(): void
}

// Rows by position, not `:nth-child`: SleekStack wraps each keyed row in a `display: contents` host element.
export const clickCell = (container: Element, rowIndex: number, cell: 2 | 3) =>
  (container.querySelectorAll('tbody tr')[rowIndex]!.querySelector(`td:nth-child(${cell}) a`) as HTMLElement).click()
