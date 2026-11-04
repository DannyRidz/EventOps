import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowGuide } from "./workflow-guide";
import { matchesSampleSetup, sampleSetup } from "./sample";
import { resolveSetup } from "@/features/events/validation";

describe("workflow guide", () => {
  it("directs a draft to explicit starting plan review and labels steps as instructions", () => {
    render(
      <WorkflowGuide
        eventId="event"
        hasStartingPlan={false}
        sample
        analysisEnabled={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Review starting plan" }),
    ).toHaveAttribute("href", "/events/event/records");
    for (const name of ["Describe", "Review", "Confirm", "Approve", "Briefing"])
      expect(screen.getByRole("heading", { name })).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "AI analysis is currently unavailable",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/keep the existing available intervals/i),
    ).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("does not show fictional sample instructions for a normal event", () => {
    render(
      <WorkflowGuide
        eventId="event"
        hasStartingPlan
        sample={false}
        analysisEnabled
      />,
    );
    expect(
      screen.getByRole("link", { name: "Describe an update" }),
    ).toHaveAttribute("href", "/events/event/updates");
    expect(
      screen.queryByText("Suggested sample update"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Synthetic Alex/)).not.toBeInTheDocument();
  });
  it("recognizes the complete canonical creation setup only", () => {
    expect(matchesSampleSetup(resolveSetup(sampleSetup))).toBe(true);
    expect(matchesSampleSetup({ ...sampleSetup, name: "Real event" })).toBe(
      false,
    );
    expect(matchesSampleSetup({ ...sampleSetup, date: "2026-11-05" })).toBe(
      false,
    );
    expect(matchesSampleSetup({ ...sampleSetup, start: "10:00" })).toBe(false);
    expect(matchesSampleSetup(null)).toBe(false);
  });
});
