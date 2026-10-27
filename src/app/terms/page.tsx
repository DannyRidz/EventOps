import { PageShell } from "@/components/ui/page-shell";
export default function Terms() {
  return (
    <PageShell>
      <article className="workspace-page narrow stack">
        <h1>Account terms</h1>
        <p>Version 27 October 2026</p>
        <p>
          Use this installation only for local evaluation with synthetic
          information. You must be at least 18 and authorized to manage the
          event information you enter. Keep email codes private.
        </p>
        <p>
          Saving event setup creates a draft. It does not approve a plan or
          notify participants. Review saved dates, times, locations and timezone
          before using them.
        </p>
        <p>
          Hosted use requires the operator’s complete terms and privacy notice.
          No paid service or external account is created by using this local
          installation.
        </p>
      </article>
    </PageShell>
  );
}
