import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

/** Real server-render failure/retry exercise. Never available in production. */
export default async function RecoveryPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.EVENTOPS_INTERNAL_UI !== "1"
  )
    notFound();
  if ((await cookies()).get("eventops-internal-recovery")?.value !== "ready") {
    throw new Error("Intentional internal recovery exercise");
  }
  return (
    <PageShell>
      <section className="state-page">
        <h1>Server recovery completed</h1>
        <p>
          The retry requested fresh server content after the failure was
          resolved.
        </p>
      </section>
    </PageShell>
  );
}
