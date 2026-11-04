import Link from "next/link";
import { sampleUpdate } from "./sample";

export function WorkflowGuide({
  eventId,
  hasStartingPlan,
  sample,
  analysisEnabled,
}: {
  eventId: string;
  hasStartingPlan: boolean;
  sample: boolean;
  analysisEnabled: boolean;
}) {
  const path = `/events/${eventId}`;
  const steps = [
    {
      name: "Describe",
      href: `${path}/updates`,
      text: "Type the operational update, save it, then confirm the exact saved text. Saving text alone does not change your plan.",
    },
    {
      name: "Review",
      href: `${path}/updates#analysis-requests`,
      text: "Open the saved analysis. Compare every interpreted request with your text. If it asks a question, give the exact missing fact, save the answer and confirm the clarified text again. You can also leave it unresolved.",
    },
    {
      name: "Confirm",
      href: `${path}/updates#analysis-requests`,
      text: "Review a validated option, its before and proposed values, and each evidence link. Confirm the complete interpretation and exact new facts before creating a proposal. A proposal is still separate from the official plan.",
    },
    {
      name: "Approve",
      href: `${path}/updates#saved-proposals`,
      text: "Open the saved proposal, review its complete changes and plan checks, then choose Review approval. Approve only the change you intend. Back or Reject preserves the current approved plan.",
    },
    {
      name: "Briefing",
      href: `${path}/briefing`,
      text: "Open the approved revision briefing. Check the schedule and assignments, then print or export it. Pending updates are excluded. History keeps the earlier revisions.",
    },
  ];
  return (
    <>
      <div className="state-panel stack">
        <h2>
          {hasStartingPlan
            ? "Your starting plan is confirmed"
            : "First, confirm your starting plan"}
        </h2>
        <p>
          {hasStartingPlan
            ? "The five steps below start from an approved plan. They describe the workflow, not completed tasks."
            : "The loaded records are a draft, not an approved plan. Open the starting plan, review its records, checks and sources, then explicitly confirm revision 1."}
        </p>
        <Link
          className="button"
          href={`${path}/${hasStartingPlan ? "updates" : "records"}`}
        >
          {hasStartingPlan ? "Describe an update" : "Review starting plan"}
        </Link>
      </div>
      <ol className="guide-steps">
        {steps.map((step) => (
          <li key={step.name}>
            <h2>{step.name}</h2>
            <p>{step.text}</p>
            <Link href={step.href}>Open {step.name.toLowerCase()} step</Link>
          </li>
        ))}
      </ol>
      {sample && (
        <section className="stack">
          <h2>Suggested sample update</h2>
          <p>
            Use this with the original sample starting plan. If you have changed
            the sample, check its current records before reusing the suggestion.
          </p>
          <blockquote className="state-panel">
            <p>{sampleUpdate}</p>
          </blockquote>
          <p>
            On Updates, choose Use sample update to fill an empty field. Review
            it before saving. This does not save, submit or approve anything.
          </p>
          <p>
            The intended result is Opening in Room 2 from 12:00 to 13:00 with
            Synthetic Sam. Workshop stays 10:00 to 11:00. This describes the
            request, not a guaranteed AI result.
          </p>
        </section>
      )}
      <section className="state-panel stack">
        <h2>
          {analysisEnabled
            ? "If analysis needs clarification"
            : "AI analysis is currently unavailable"}
        </h2>
        <p>
          {analysisEnabled
            ? "Do not treat a suggestion as an official change. Missing facts and unresolved questions need your review before proceeding."
            : "You can still save text and try the complete manual proposal and approval path. No AI analysis runs while access is disabled."}
        </p>
        <Link href={`${path}/records`}>Prepare manual changes</Link>
        {sample && (
          <>
            <p>For the sample update, edit these exact records:</p>
            <ol>
              <li>Sessions: move Opening to Room 2, 12:00 to 13:00.</li>
              <li>
                Availability: keep the existing available intervals and add
                Synthetic Alex as unavailable, 10:00 to 13:00.
              </li>
              <li>
                Assignments: change Opening’s assignment to Synthetic Sam, 12:00
                to 13:00, role usher. Keep Workshop’s assignment unchanged.
              </li>
            </ol>
            <p>
              Review all records, confirm the exact manual assertions, add a
              reason, and save the proposal. Review and approve it separately.
              The reason is context for manual edits, not an AI instruction.
            </p>
          </>
        )}
      </section>
    </>
  );
}
