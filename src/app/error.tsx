"use client";
import { PageShell } from "@/components/ui/page-shell";
import { ErrorState } from "@/components/ui/states";
export default function ErrorPage({
  retry,
}: Readonly<{ error: Error & { digest?: string }; retry: () => void }>) {
  return (
    <PageShell>
      <section className="state-page">
        <h1>Something interrupted this page.</h1>
        <ErrorState onRetry={retry} />
      </section>
    </PageShell>
  );
}
