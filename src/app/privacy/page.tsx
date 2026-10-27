import { PageShell } from "@/components/ui/page-shell";
export default function Privacy() {
  return (
    <PageShell>
      <article className="workspace-page narrow stack">
        <h1>Account privacy notice</h1>
        <p>Version 27 October 2026</p>
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
          This installation is for local evaluation. The operator must supply
          their identity, contact details, retention policy and applicable
          privacy rights before accepting real accounts on a hosted service. Use
          synthetic information here.
        </p>
      </article>
    </PageShell>
  );
}
