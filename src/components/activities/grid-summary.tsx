import { getWebEnvironment } from "@/server/env";
import { householdGridSummary } from "@/server/grid/summary";
import { londonLabel } from "@/lib/presentation";
import styles from "@/components/home/landing.module.css";

const timeLabel = (utc: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(utc));

export function GridSummaryLoading() {
  return <aside className={styles.signal} aria-label="Loading Great Britain grid context"><div className={styles.signalHeader}><span>Great Britain · National grid</span><span>Loading</span></div><p role="status" className={styles.signalPeriod}>Loading current source context…</p><div aria-hidden="true"><div className={`${styles.skeleton} ${styles.skeletonValue}`} /><div className={`${styles.skeleton} ${styles.skeletonChart}`} /><div className={`${styles.skeleton} ${styles.skeletonFoot}`} /></div></aside>;
}

export async function GridSummary() {
  const summary = getWebEnvironment().publicGridSummary ? await householdGridSummary() : { available: false as const };
  if (!summary.available) return <aside className={styles.signal} aria-label="Current Great Britain grid context"><div className={styles.signalHeader}><span>Great Britain · National grid</span><span>Source unavailable</span></div><div className={styles.signalEmpty}><h2>Your inputs<br />still matter.</h2><p>Current grid context is unavailable. The simulator can still estimate electricity from your device inputs; a CO₂ estimate needs applicable grid data.</p></div><p className={styles.signalSource}>National forecast context. Your home’s consumption is not measured.</p></aside>;
  const maximum = Math.max(1, ...summary.intervals.map((interval) => interval.forecastGPerKwh ?? 0));
  const barWidth = 480 / summary.intervals.length;
  return <aside className={styles.signal} aria-label="Current Great Britain grid context">
    <div className={styles.signalHeader}><span>Great Britain · National grid</span><span className={styles.signalStatus}>Forecast</span></div>
    <h2 className={styles.signalTitle}>The grid, in this half-hour.</h2>
    <p className={styles.signalValue}>{summary.current.forecastGPerKwh === null ? "Unavailable" : <>{summary.current.forecastGPerKwh}<span>g CO₂ / kWh</span></>}</p>
    <p className={styles.signalPeriod}>{londonLabel(summary.current.fromUtc)} · forecast, not measured use</p>
    <figure className={styles.forecastGraphic}>
      <svg viewBox="0 0 480 92" role="img" aria-label="Upcoming half-hour grid carbon forecasts; bar height shows grams of CO₂ per kilowatt-hour, starting at zero. The highlighted bar is the lowest forecast interval.">
        {summary.intervals.map((interval, index) => { const height = interval.forecastGPerKwh === null ? 0 : interval.forecastGPerKwh / maximum * 82; return <rect key={interval.fromUtc} x={index * barWidth + 1} y={88 - height} width={Math.max(1, barWidth - 3)} height={height} rx="1.5" fill={interval.fromUtc === summary.lowest?.fromUtc ? "#165d3b" : "#c3d4b7"} />; })}
        <line x1="0" y1="89" x2="480" y2="89" stroke="#d3ddcf" />
      </svg>
      <figcaption className={styles.forecastLabels}><span>{timeLabel(summary.current.fromUtc)} · London</span><span>Upcoming half-hours</span><span>{timeLabel(summary.intervals.at(-1)!.toUtc)}</span></figcaption>
    </figure>
    {summary.lowest ? <div className={styles.signalLow}><div><span>Lowest upcoming half-hour</span><small>{londonLabel(summary.lowest.fromUtc)}</small></div><p>{summary.lowest.forecastGPerKwh}<span> g/kWh</span></p></div> : null}
    <p className={styles.signalSource}><a href={summary.sourceUrl} target="_blank" rel="noreferrer">Carbon Intensity API</a> · Retrieved {londonLabel(summary.retrievedAtUtc)}.<br />Source cached for five minutes. A whole task’s best time can differ.</p>
    <details className={styles.signalDetails}><summary>Source details &amp; forecast values</summary><p>{summary.attribution}. National forecast context, not a reading from your home.</p><div className={styles.signalTable} tabIndex={0} role="region" aria-label="Scrollable forecast values"><table><caption className="sr-only">Upcoming GB national half-hour forecast values, with London dates and times.</caption><thead><tr><th scope="col">London time</th><th scope="col">g CO₂ / kWh</th></tr></thead><tbody>{summary.intervals.map((interval) => <tr key={interval.fromUtc}><td>{londonLabel(interval.fromUtc)}</td><td>{interval.forecastGPerKwh ?? "Unavailable"}</td></tr>)}</tbody></table></div></details>
  </aside>;
}
