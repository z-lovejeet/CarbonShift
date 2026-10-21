export default function HomePage() {
  return (
    <>
      <section className="intro-grid" aria-labelledby="intro-heading">
        <div className="intro-copy">
          <p className="eyebrow">A little flexibility goes a long way</p>
          <h1 id="intro-heading">Better timing starts<br className="desktop-break" /> with your day.</h1>
          <p className="lead">CarbonShift will help you find a lower-carbon time for your wash, around the time you actually have.</p>
          <a href="#how-it-works" className="button primary-link">Explore the approach <span aria-hidden="true">↗</span></a>
        </div>
        <aside className="availability" aria-labelledby="availability-heading">
          <p className="eyebrow">Live planning</p>
          <h2 id="availability-heading">Coming soon.</h2>
          <p>Recommendations aren’t available yet. There’s nothing to connect or switch on.</p>
          <dl className="scope-list">
            <div><dt>Grid signal</dt><dd>Great Britain, national</dd></div>
            <div><dt>Cycle energy</dt><dd>Your confirmed estimate</dd></div>
          </dl>
        </aside>
      </section>
      <section className="approach-section" id="how-it-works" aria-labelledby="approach-heading">
        <div className="section-intro"><p className="eyebrow">The approach</p><h2 id="approach-heading">Your routine comes first.</h2></div>
        <ol className="approach-list">
          <li><span className="step-index" aria-hidden="true">01</span><div><h3>Make a little room</h3><p>You’ll choose a wash duration, a finish deadline, and the times that don’t work for you.</p></div></li>
          <li><span className="step-index" aria-hidden="true">02</span><div><h3>See the difference</h3><p>Compare a suggested time with the time you would otherwise use, under the same energy assumption.</p></div></li>
          <li><span className="step-index" aria-hidden="true">03</span><div><h3>Keep the context</h3><p>See where the grid estimate comes from and what it can tell you. You stay in control of the appliance.</p></div></li>
        </ol>
      </section>
      <details className="estimate-note">
        <summary>What does “lower-carbon” mean here?</summary>
        <p>It means a lower estimate using Great Britain’s national grid signal and an assumed amount of cycle energy. It won’t measure your appliance or prove that emissions were avoided.</p>
      </details>
    </>
  );
}
