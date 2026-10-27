import { render, screen } from "@testing-library/react";
import Link from "next/link";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { TextField } from "./text-field";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { FoundationChecks } from "../../app/internal/foundation/foundation-checks";

describe("foundation controls, AC-27 and AC-28", () => {
  it("does not accidentally submit a containing form", async () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button>Open evidence</Button>
      </form>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Open evidence" }));
    expect(submit).not.toHaveBeenCalled();
  });
  it("does not allow a disabled approval action", async () => {
    const approve = vi.fn();
    render(
      <Button disabled onClick={approve}>
        Approve revision
      </Button>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Approve revision" }));
    expect(approve).not.toHaveBeenCalled();
  });
  it("connects a field label, hint, error and external description", () => {
    render(
      <>
        <p id="context">Event timezone applies.</p>
        <TextField
          label="Start time"
          hint="Use HH:mm."
          error="Enter a time."
          aria-describedby="context"
          required
        />
      </>,
    );
    const input = screen.getByRole("textbox", {
      name: "Start time",
    });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Use HH:mm. Enter a time. Event timezone applies.",
    );
  });
  it("gives separate controls unique labels and retains typed input on an error", async () => {
    const { rerender } = render(
      <>
        <TextField label="Event name" />
        <TextField label="Location" />
      </>,
    );
    const name = screen.getByRole("textbox", { name: "Event name" });
    const location = screen.getByRole("textbox", { name: "Location" });
    expect(name.id).not.toBe(location.id);
    await userEvent.setup().type(name, "Community event");
    rerender(
      <>
        <TextField label="Event name" error="Check this name." />
        <TextField label="Location" />
      </>,
    );
    expect(name).toHaveValue("Community event");
  });
  it("announces actual loading without invented progress", () => {
    render(<LoadingState label="Checking the plan" />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking the plan");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("provides a useful empty state and its action", () => {
    render(
      <EmptyState
        title="No events yet"
        action={<Link href="/#prepare">What to prepare</Link>}
      >
        Your confirmed plans will appear here.
      </EmptyState>,
    );
    expect(
      screen.getByRole("heading", { name: "No events yet" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "What to prepare" }),
    ).toHaveAttribute("href", "/#prepare");
  });
  it("permits retry using the keyboard", async () => {
    const retry = vi.fn();
    render(<ErrorState onRetry={retry} />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(retry).toHaveBeenCalledOnce();
  });
  it("exercises recovery and field validation in the isolated internal surface", async () => {
    render(<FoundationChecks />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Retry completed")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Check field error" }));
    expect(
      screen.getByRole("textbox", { name: "Event name" }),
    ).toHaveAccessibleDescription(
      "Use a name you can recognize later. Choose a name for this event.",
    );
  });
});
