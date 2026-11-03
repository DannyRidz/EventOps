import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ProposalActions } from "./proposal-actions";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const props = {
  eventId: "event",
  proposalId: "proposal",
  baseId: "base",
  generation: 1,
  digest: "digest",
  next: 2,
  allowed: true,
};
it("requires an explicit second approval step and reuses the receipt key after lost response", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Lost response"));
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<ProposalActions {...props} />);
  await user.click(screen.getByRole("button", { name: "Review approval" }));
  expect(fetch).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Approve revision 2" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Lost response");
  await user.click(screen.getByRole("button", { name: "Approve revision 2" }));
  expect(JSON.parse(fetch.mock.calls[0]![1].body).idempotency_key).toBe(
    JSON.parse(fetch.mock.calls[1]![1].body).idempotency_key,
  );
});
it("disables approval when stale or blocked", () => {
  render(<ProposalActions {...props} allowed={false} />);
  expect(
    screen.getByRole("button", { name: "Review approval" }),
  ).toBeDisabled();
});
it("moves keyboard focus into confirmation and restores it when returning", async () => {
  const user = userEvent.setup();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<ProposalActions {...props} />);
  await user.tab();
  await user.tab();
  expect(screen.getByRole("button", { name: "Review approval" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("heading", { name: "Confirm approval" }),
  ).toHaveFocus();
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Approve revision 2" }),
  ).toHaveFocus();
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Back to proposal" }),
  ).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Review approval" })).toHaveFocus();
  expect(fetch).not.toHaveBeenCalled();
});
