import Link from "next/link";
import type { ReactNode } from "react";

export function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <header className="site-header">
        <Link href="/" className="wordmark" aria-label="EventOps home">
          Event<span>Ops</span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/#workflow">The workflow</Link>
          <Link href="/#prepare">What to prepare</Link>
        </nav>
      </header>
      <main id="main-content" className="page-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <p>EventOps. Keep your event plan clear.</p>
        <Link href="/#prepare">Event preparation checklist</Link>
      </footer>
    </>
  );
}
