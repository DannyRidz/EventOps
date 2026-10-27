"use client";
import type { ReactNode } from "react";
import { Button } from "./button";

export function EmptyState({
  title,
  children,
  action,
}: Readonly<{ title: string; children: ReactNode; action?: ReactNode }>) {
  return (
    <section className="state-panel">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
export function LoadingState({
  label = "Loading your plan",
}: Readonly<{ label?: string }>) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <p>{label}</p>
      <div className="loading-stack" aria-hidden="true">
        <div className="loading-line" />
        <div className="loading-line loading-line-short" />
      </div>
    </div>
  );
}
export function ErrorState({
  title = "We couldn’t load this page",
  children = "Please try again. Your saved records have not been changed.",
  onRetry,
}: Readonly<{ title?: string; children?: ReactNode; onRetry: () => void }>) {
  return (
    <section className="state-panel error-panel" role="alert">
      <h2>{title}</h2>
      <p>{children}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </section>
  );
}
