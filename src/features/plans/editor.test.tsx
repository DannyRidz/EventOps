import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { PlanEditor } from "./editor";
import { fixturePlan } from "./fixtures";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows saved candidate checks and blocks initial confirmation when invalid", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        snapshot: fixturePlan(),
        generation: 2,
        candidate_digest: "digest",
        validation_report: [
          { rule: "COVERAGE", record_ids: [], message: "Missing volunteer" },
        ],
      }),
    }),
  );
  render(<PlanEditor eventId="event" initial={fixturePlan()} generation={1} />);
  expect(
    screen.queryByRole("button", {
      name: "Confirm starting plan as revision 1",
    }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("checkbox", {
      name: "I confirm these manually entered facts and exact changes.",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Save records and check plan" }),
  );
  expect(await screen.findByText(/Missing volunteer/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Confirm starting plan as revision 1" }),
  ).toBeDisabled();
  expect(screen.getByText("Required features: projector")).toBeInTheDocument();
});
