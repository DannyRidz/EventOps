import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";

const preparation = [
  {
    title: "Event details",
    detail: "The date, timezone, operating hours, and locations.",
  },
  {
    title: "Schedule and rooms",
    detail: "Session times, room names, capacity, and any required equipment.",
  },
  {
    title: "Volunteer roster",
    detail: "Names, roles, confirmed availability, and existing assignments.",
  },
];

export default function Home() {
  return (
    <PageShell>
      <section className="hero" aria-labelledby="intro-title">
        <div className="hero-copy">
          <p className="eyebrow">For the people behind the event</p>
          <h1 id="intro-title">
            Keep your event plan consistent when things change.
          </h1>
          <p className="lead">
            Schedules, rooms, and volunteer assignments belong together. Start
            with a clear plan, then review each change before it becomes
            official.
          </p>
          <Link className="button" href="#prepare">
            What to prepare
          </Link>
        </div>
        <aside className="principles" aria-label="How your plan stays clear">
          <p className="section-label">One clear distinction</p>
          <div className="principle-row">
            <span className="step-number">01</span>
            <div>
              <h2>Your starting plan</h2>
              <p>The records you have checked and confirmed.</p>
            </div>
          </div>
          <div className="principle-row">
            <span className="step-number">02</span>
            <div>
              <h2>A proposed change</h2>
              <p>What would change, why, and the evidence behind it.</p>
            </div>
          </div>
          <div className="principle-row">
            <span className="step-number">03</span>
            <div>
              <h2>Your approved revision</h2>
              <p>The plan you choose to make official.</p>
            </div>
          </div>
        </aside>
      </section>
      <section
        id="workflow"
        className="workflow-section"
        aria-labelledby="workflow-title"
      >
        <div className="section-heading">
          <p className="section-label">From update to decision</p>
          <h2 id="workflow-title">A change should leave you with clarity.</h2>
        </div>
        <ol className="workflow-list">
          <li>
            <span className="step-number">01</span>
            <h3>Describe the update</h3>
            <p>
              Make the request specific. Include the affected session, room, or
              volunteer.
            </p>
          </li>
          <li>
            <span className="step-number">02</span>
            <h3>Check the consequences</h3>
            <p>
              Look at room conflicts, volunteer coverage, dependencies, and
              missing information.
            </p>
          </li>
          <li>
            <span className="step-number">03</span>
            <h3>Review before approval</h3>
            <p>
              Compare the proposed changes with your current plan. Keep
              unresolved questions visible.
            </p>
          </li>
        </ol>
      </section>
      <section
        id="prepare"
        className="prepare-section"
        aria-labelledby="prepare-title"
      >
        <div className="section-heading">
          <p className="section-label">Before you start</p>
          <h2 id="prepare-title">Bring the facts your event depends on.</h2>
          <p>
            Keep these records together. An unknown detail should stay unknown
            until you can confirm it.
          </p>
        </div>
        <ul className="preparation-list">
          {preparation.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </li>
          ))}
        </ul>
        <p className="format-note">
          For file entry, prepare UTF 8 CSV files. Keep dates and times in the
          event&apos;s timezone. Avoid including personal information that is
          not needed to run the event.
        </p>
      </section>
    </PageShell>
  );
}
