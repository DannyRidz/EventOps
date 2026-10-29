import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { PrivacySettings } from "./settings-form";
import type { Settings } from "./data";
const initial: Settings = {
  workspace_id: "11111111-1111-4111-8111-111111111111",
  generation: 1,
  deletion_requested_at: null,
  purge_after: null,
  events: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Synthetic retention day",
      status: "active",
      retention_days: 90,
      generation: 1,
      event_date: "2026-11-02",
      timezone: "Asia/Brunei",
      retention_deadline: "2027-02-01T16:00:00Z",
      purge_after: "2027-02-01T16:00:00Z",
    },
  ],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("privacy settings controls", () => {
  it("previews retention and asks before hiding an event", async () => {
    const user = userEvent.setup(),
      fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<PrivacySettings initial={initial} />);
    await user.selectOptions(screen.getByLabelText("Event retention"), "30");
    expect(screen.getByText(/Selected retention ends/)).toHaveTextContent(
      "2026-12-02T16:00:00Z",
    );
    await user.click(screen.getByRole("button", { name: "Move to trash" }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Confirm move to trash" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep event" }));
    expect(
      screen.queryByRole("button", { name: "Confirm move to trash" }),
    ).not.toBeInTheDocument();
  });
  it("announces a failed save and preserves available recovery actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: "Reload settings before trying again.",
        }),
      }),
    );
    render(<PrivacySettings initial={initial} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Archive event" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Reload settings before trying again.",
      ),
    );
    expect(screen.getByRole("button", { name: "Archive event" })).toBeEnabled();
  });
  it("disables content exports during account deletion and offers explicit recovery", () => {
    render(
      <PrivacySettings
        initial={{
          ...initial,
          deletion_requested_at: "2026-10-29T00:00:00Z",
          purge_after: "2026-11-05T00:00:00Z",
          events: [],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Account deletion scheduled" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Download workspace ZIP" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel account deletion" }),
    ).toBeVisible();
  });
});
