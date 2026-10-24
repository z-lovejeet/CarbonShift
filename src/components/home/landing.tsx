import Link from "next/link";
import { Suspense } from "react";
import { GridSummary, GridSummaryLoading } from "@/components/activities/grid-summary";
import { WorkflowPicker } from "./workflow-picker";
import styles from "./landing.module.css";
import { activityCategories } from "@/domain/activities/schemas";
import { ACTIVITY_METHOD } from "@/domain/activities/method";
import { ACTIVITY_PROFILES } from "@/data/activity-profiles";
import { ACTIVITY_LABELS } from "@/lib/activity-input";

const activityNotes: Record<(typeof activityCategories)[number], string> = {
  washing: "Laundry, on your schedule.", dishwasher: "A window after the dishes.", drying: "After the wash is finished.",
  television: "Your viewing time, included.", computer: "Work, study or play.", lighting: "One light or a whole room.",
  fan: "Comfort, with a clearer estimate.", vacuuming: "The minutes the motor runs.", ironing: "Make room for the smaller jobs.",
  car_cleaning: "Model the equipment you use.", charging: "Use your charger’s energy input.", custom: "Your device. Your own details.",
};
const questions = [
  ["How many activities can I model?", `There are ${activityCategories.length - 1} named categories and a custom option for other electrical activities. A plan can contain up to ${ACTIVITY_METHOD.maximumTasks} tasks. Categories organize your inputs; they do not automatically identify a device or measure its consumption.`],
  ["Where does the energy estimate come from?", `You enter operating watts or energy per cycle, duration and quantity. You can also review one of ${ACTIVITY_PROFILES.length} exact appliance references. If the energy is unknown, we ask for it instead of inventing a number.`],
  ["Will changing time use less electricity?", "A timing-only comparison keeps energy, duration and quantity the same. A lower grid CO₂ estimate comes from when electricity is used, rather than a claim that the device uses less electricity."],
  ["What if no cleaner time fits?", "A valid comparison can show no improvement found. In task planning, you can request a separate 30-minute window extension, then decide whether to apply and review the changed windows. Conflicting or too-short windows have their own errors."],
  ["Is it available everywhere?", "Current carbon guidance uses Great Britain’s national grid signal and Europe/London time. People elsewhere can explore the clearly labeled example, but GB data is not a local recommendation for another country."],
  ["Does it control my devices?", "No. You choose and operate your equipment. CarbonShift does not connect to a smart meter or start an appliance. Use safe operating times and follow your device’s instructions."],
  ["Do I need AI or a wallet?", "Manual planning works without AI capacity. Optional AI helps interpret your request and explain results, with your review. Ordinary planning needs no wallet; the prototype issuer handles separately consented Sepolia testnet publication."],
  ["Is a reported saving measured?", "No. Device energy uses reviewed assumptions and execution is self-reported. Updated grid factors can improve an estimate. A blockchain record can help verify its content and timing; neither establishes measured avoided emissions."],
] as const;

export function LandingPage() {
  return (
    <div className={styles.homePage}>
      <section className={styles.hero} aria-labelledby="intro-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Everyday energy, better timed</p>
          <h1 id="intro-heading">Same routine.<br /><span>Better timing.</span></h1>
          <p className={styles.heroLead}>Estimate your electricity use, then find lower-carbon times for the things you do every day.</p>
          <div className={styles.heroActions}><Link href="/app/simulate" className={`button ${styles.primaryAction}`}>Explore an activity <span aria-hidden="true">↗</span></Link><Link href="/demo" className={styles.quietLink}>See an example <span aria-hidden="true">→</span></Link></div>
        </div>
        <Suspense fallback={<GridSummaryLoading />}><GridSummary /></Suspense>
      </section>
      <div className={styles.scopeStrip} aria-label="Platform capabilities"><p>Built around the energy<br /><strong>in your everyday life.</strong></p><dl><div><dt>Activity categories</dt><dd>{activityCategories.length}<span>including custom</span></dd></div><div><dt>Tasks in one plan</dt><dd><span className={styles.upTo}>up to</span>{ACTIVITY_METHOD.maximumTasks}</dd></div><div><dt>Appliance references</dt><dd>{ACTIVITY_PROFILES.length}<span>exact, reviewed models</span></dd></div></dl></div>
      <section className={styles.whySection} aria-labelledby="why-heading"><div><h2 id="why-heading">A small shift starts<br />with a clearer picture.</h2><p>You know what needs doing. CarbonShift helps you understand its electricity use, then look for a lower-carbon window that fits.</p></div><ul className={styles.principles}><li><span aria-hidden="true">01</span><div><h3>The grid changes through the day.</h3><p>The mix supplying the national grid changes. The forecast lets us compare the same task at different times.</p></div></li><li><span aria-hidden="true">02</span><div><h3>Your availability sets the boundaries.</h3><p>Keep appointments fixed. Block busy periods. Put washing before drying, or reserve equipment for one job at a time.</p></div></li><li><span aria-hidden="true">03</span><div><h3>The assumptions stay in view.</h3><p>See the device energy, source data, original time and proposed time behind each estimate.</p></div></li></ul></section>
      <section id="your-workspace" className={styles.workspaceSection} aria-labelledby="workspace-heading"><div className={styles.sectionHeading}><h2 id="workspace-heading">A little task.<br />Or a day full of them.</h2><p>Three separate workspaces, depending on how much you want to plan.</p></div><WorkflowPicker maximumTasks={ACTIVITY_METHOD.maximumTasks} /></section>
      <section id="activities" className={styles.activitiesSection} aria-labelledby="activities-heading">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>The everyday activity catalogue</p><h2 id="activities-heading">More than the<br />washing machine.</h2><p>{activityCategories.length - 1} familiar categories, plus room for your own. Use your device details, or confirm an exact reference where one is available.</p></div>
        <ul className={styles.activityGrid}>{activityCategories.map((category, index) => {
          const referenceAvailable = ACTIVITY_PROFILES.some((profile) => profile.category === category);
          return <li key={category} className={category === "custom" ? styles.customActivity : undefined}><span className={styles.activityNumber}>{String(index + 1).padStart(2, "0")}</span><h3>{ACTIVITY_LABELS[category]}</h3><p>{activityNotes[category]}</p><span className={styles.activityBasis}>{referenceAvailable ? "Reviewed reference available" : "Use your device’s energy"}</span></li>;
        })}</ul>
        <div className={styles.catalogueNote}><p><strong>The category is a starting point.</strong> Your actual watts, cycle energy, duration and equipment make the estimate yours. Car cleaning can include powered equipment, or no direct electricity; water and detergent impacts sit outside this calculation.</p><Link href="/methodology" className={styles.quietLink}>How estimates work <span aria-hidden="true">↗</span></Link></div>
      </section>
      <section className={styles.processSection} id="how-it-works" aria-labelledby="process-heading"><h2 id="process-heading">From “I need to do this”<br />to a plan you understand.</h2><ol className={styles.processSteps}><li><span>01</span><h3>Bring your real inputs.</h3><p>Choose an activity or describe it. Confirm the equipment, energy and active duration.</p></li><li><span>02</span><h3>Make space in your day.</h3><p>Add your usual time, available windows, fixed tasks and any order the jobs need to follow.</p></li><li><span>03</span><h3>Compare, then decide.</h3><p>Review the original and suggested estimates together. Save only the schedule you choose.</p></li><li><span>04</span><h3>Keep the record useful.</h3><p>Report each activity, correct it when needed and refresh estimates as actual grid factors arrive.</p></li></ol></section>
      <section className={styles.evidenceSection} aria-labelledby="evidence-heading"><div className={styles.evidenceCopy}><p className={styles.eyebrow}>A clearer kind of climate claim</p><h2 id="evidence-heading">Keep the reasoning<br />with the result.</h2><p>Your plan is private by default. If you choose to publish, an exact preview shows the timing and energy details that will become public.</p><p>The optional Sepolia receipt binds those reviewed inputs to a record. Download the calculation bundle and check it independently, with each evidence layer shown separately.</p><div className={styles.evidenceLinks}><Link className={styles.quietLink} href="/verify">Open the local verifier <span aria-hidden="true">↗</span></Link><Link className={styles.quietLink} href="/privacy">Read the privacy details <span aria-hidden="true">↗</span></Link></div></div><div className={styles.evidenceLayers}><p className={styles.layerHeading}>What stays with a published plan</p><ol><li><span>01</span><div><h3>The reviewed schedule</h3><p>Tasks, timing constraints and energy assumptions.</p></div></li><li><span>02</span><div><h3>The source behind the numbers</h3><p>The frozen grid forecast and reproducible calculation.</p></div></li><li><span>03</span><div><h3>A separately checkable commitment</h3><p>Content integrity and timing on the Sepolia test network.</p></div></li></ol><p className={styles.proofLimit}>A matching record does not measure your appliance or certify avoided emissions. Reported execution remains self-reported.</p></div></section>
      <section className={styles.faqSection} aria-labelledby="faq-heading"><h2 id="faq-heading">A few things<br />worth knowing.</h2><div className={styles.faqGrid}>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className={styles.closingSection} aria-labelledby="closing-heading"><div><h2 id="closing-heading">Start with the next thing<br />on your list.</h2><p>One device. One time window. A clearer estimate.</p></div><Link href="/app/simulate" className={`button ${styles.primaryAction}`}>Explore an activity <span aria-hidden="true">↗</span></Link></section>
    </div>
  );
}
