"use client";
import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

/** Internal component exercise only, never available from a production build. */
export function FoundationChecks() {
  const [recovered, setRecovered] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  return (
    <PageShell>
      <div className="internal-heading">
        <h1>Foundation UI checks</h1>
        <p>
          Internal component verification. These isolated states do not read or
          write event records.
        </p>
      </div>
      <div className="component-grid">
        <EmptyState
          title="No events yet"
          action={
            <Link className="button button-secondary" href="/#prepare">
              What to prepare
            </Link>
          }
        >
          Your confirmed event plans will appear here.
        </EmptyState>
        <section aria-label="Loading state">
          <LoadingState />
        </section>
        <section aria-label="Recovery state">
          {recovered ? (
            <div className="state-panel" role="status">
              <h2>Retry completed</h2>
              <p>The recovery control is working.</p>
            </div>
          ) : (
            <ErrorState onRetry={() => setRecovered(true)} />
          )}
        </section>
        <section className="state-panel">
          <h2>Form controls</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setFieldError("Choose a name for this event.");
            }}
            noValidate
          >
            <TextField
              label="Event name"
              name="event-name"
              required
              hint="Use a name you can recognize later."
              error={fieldError}
            />
            <div style={{ marginTop: "var(--space-4)" }}>
              <Button type="submit">Check field error</Button>
            </div>
          </form>
          <Button disabled>Approve revision</Button>
          <p>Approval is unavailable while required information is missing.</p>
        </section>
        <section className="state-panel">
          <h2>Revision comparison</h2>
          <p>No proposed changes to review.</p>
          <dl className="comparison">
            <div>
              <dt>Current value</dt>
              <dd>No record selected</dd>
            </div>
            <div>
              <dt>Proposed value</dt>
              <dd>No change proposed</dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>No source selected</dd>
            </div>
          </dl>
        </section>
      </div>
    </PageShell>
  );
}
