import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
export const metadata: Metadata = { title: "Page not found" };
export default function NotFound() {
  return (
    <PageShell>
      <section className="state-page">
        <p className="section-label">Page not found</p>
        <h1>Let’s get you back to your plan.</h1>
        <p>
          This page may have moved, or the address may be incorrect. Return to
          EventOps to continue.
        </p>
        <Link className="button" href="/">
          Return to EventOps
        </Link>
      </section>
    </PageShell>
  );
}
