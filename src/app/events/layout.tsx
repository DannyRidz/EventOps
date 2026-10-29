import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authenticatedClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { SignOut } from "@/features/auth/sign-out";
export const dynamic = "force-dynamic";
export default async function EventsLayout({
  children,
}: {
  children: ReactNode;
}) {
  let authError = false;
  try {
    await authenticatedClient();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED")
      authError = true;
    else
      return (
        <PageShell>
          <section className="state-page">
            <h1>Workspace temporarily unavailable</h1>
            <p>Please try again shortly.</p>
            <Link className="button" href="/events">
              Try again
            </Link>
          </section>
        </PageShell>
      );
  }
  if (authError) redirect("/sign-in");
  return (
    <PageShell>
      <div className="workspace-bar">
        <Link href="/events">My events</Link>
        <Link href="/events/settings">Privacy and recovery</Link>
        <SignOut />
      </div>
      {children}
    </PageShell>
  );
}
