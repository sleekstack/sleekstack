/** @jsxImportSource @sleekstack/ui */

// The module `lazy` loads: its default export is the component.
export default ({ values }: { values: ReadonlyArray<number> }) => (
  <svg viewBox={`0 0 ${values.length * 12} 40`} width={values.length * 24} height={80}>
    {values.map((v, i) => (
      <rect key={i} x={i * 12} y={40 - v * 4} width={10} height={v * 4} />
    ))}
  </svg>
)
