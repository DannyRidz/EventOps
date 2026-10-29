import { PageShell } from "@/components/ui/page-shell";
export default function Privacy() {
  return (
    <PageShell>
      <article className="workspace-page narrow stack">
        <h1>Account privacy notice</h1>
        <p>Version 27 October 2026, handling details updated 29 October 2026</p>
        <p>
          Your email is used to verify access. EventOps stores your adult
          attestation and notice versions with your account. Saved event setup
          belongs to your private workspace.
        </p>
        <p>
          Authentication and event records are processed using Supabase. Email
          codes are delivered through the configured mail service. Do not enter
          sensitive personal information in event names or location labels.
        </p>
        <p>
          Setup drafts are not sent to an AI model. The application does not
          save event forms in browser local storage. Signing out ends access
          from this browser.
        </p>
        <p>
          EventOps supports adult organizers and adult volunteer rosters. Use
          names or aliases, availability and role tags only. Do not enter
          identity documents, phone numbers, health information or attendee
          profiles.
        </p>
        <p>
          Confirmed text, source values and revisions are retained until event
          purge, normally 90 days after the event date. You can select 30 or 365
          days. Setup drafts expire after 30 inactive days. Trash is recoverable
          for seven days unless retention expires sooner. Archive is read only.
        </p>
        <p>
          Original CSV files expire after 30 days. Raw recordings expire within
          24 hours of transcription finalization, with a seven day absolute
          maximum, and can be discarded earlier. Frozen imported cells and
          confirmed text remain until event purge. File expiry removes both
          private object bytes and any database byte copy.
        </p>
        <p>
          Privacy and recovery settings provide a private workspace ZIP and
          account deletion. Account deletion needs a recent sign in, disables
          access immediately and allows explicit cancellation for seven days.
          Purge removes event content, private files and the sign in identity. A
          downloaded copy remains under your control.
        </p>
        <p>
          Live AI is disabled in this installation. If enabled after operator
          verification, bounded confirmed text and event context may be
          processed by Meta, and recordings may be transcribed by Meta. Provider
          abuse records may have separate retention. Authentication, mail and
          model processing may occur outside the application region. No regional
          confinement is promised.
        </p>
        <p>
          Recovery backups can retain deleted content until expiry. The
          operational target is seven days. A separate ledger of opaque deletion
          identifiers is reapplied before restored data is served. Hosted backup
          scheduling and provider exceptions require operator verification.
          Operational logs exclude event content and use a 14 day target;
          aggregate counts use 90 days. No hosted monitoring service is
          connected here.
        </p>
        <p>
          This installation is for local evaluation. The operator must supply
          their identity, contact details and applicable privacy rights before
          accepting real accounts on a hosted service. Use synthetic information
          here.
        </p>
      </article>
    </PageShell>
  );
}
