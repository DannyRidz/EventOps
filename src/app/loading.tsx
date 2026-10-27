import { PageShell } from "@/components/ui/page-shell";
import { LoadingState } from "@/components/ui/states";
export default function Loading() {
  return (
    <PageShell>
      <section className="state-page">
        <h1>Opening EventOps</h1>
        <LoadingState label="Loading this page" />
      </section>
    </PageShell>
  );
}
