/** @jsxImportSource @sleekstack/ui */

/** Points at the ui devtools panel, which `main` opens below the two views in development only. */
export const DevtoolsDemo = () => (
  <section className="demo devtools">
    <h2>Devtools</h2>
    {import.meta.env.DEV ? (
      <p>
        The panel below the two views shows each mount's instance tree, the atoms each instance reads, its re-runs and
        its effect runs. <a href="#devtools">Go to the panel</a>
      </p>
    ) : (
      <p className="muted">A production build leaves the devtools panel out. Run the app in development to see it.</p>
    )}
  </section>
)
