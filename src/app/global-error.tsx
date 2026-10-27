"use client";
import "./globals.css";
import { PageShell } from "@/components/ui/page-shell";
import { ErrorState } from "@/components/ui/states";
export default function GlobalError({
  retry,
}: Readonly<{ error: Error & { digest?: string }; retry: () => void }>) {
  return (
    <html lang="en">
      <head>
        <title>Unable to open page | EventOps</title>
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <PageShell>
          <section className="state-page">
            <h1>EventOps couldn’t open this page.</h1>
            <ErrorState onRetry={retry} />
          </section>
        </PageShell>
      </body>
    </html>
  );
}
