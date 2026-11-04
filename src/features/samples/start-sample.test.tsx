import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartSample } from "./start-sample";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const id = "12345678-1234-4234-8234-123456789abc";
beforeEach(() => {
  sessionStorage.clear();
  push.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reviewed sample loading", () => {
  it("requires explicit review and prevents repeated pending submissions", async () => {
    const user = userEvent.setup();
    let reject!: (reason: Error) => void;
    const fetch = vi.fn(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<StartSample />);
    const button = screen.getByRole("button", {
      name: "Load or resume sample event",
    });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(button);
    expect(
      screen.getByRole("button", { name: "Loading sample…" }),
    ).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    reject(new Error("Offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(button).toBeEnabled();
  });
  it("makes no request if a retry UUID cannot be retained", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    render(<StartSample />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Load or resume sample event" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "cannot retain this sample request",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Create an event manually" }),
    ).toHaveAttribute("href", "/events/new");
  });
  it("offers the actual saved draft after a partial failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ event_id: id }),
        })
        .mockRejectedValueOnce(new Error("Read failed")),
    );
    render(<StartSample />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Load or resume sample event" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Read failed");
    expect(
      screen.getByRole("link", { name: "Open saved sample draft" }),
    ).toHaveAttribute("href", `/events/${id}/records`);
    expect(push).not.toHaveBeenCalled();
  });
  it("resumes staged records and navigates to their guide without another write", async () => {
    const user = userEvent.setup();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ event_id: id }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          approved_revision: null,
          draft: {
            generation: 2,
            snapshot: {},
            plan_snapshot: { saved: true },
          },
        }),
      });
    vi.stubGlobal("fetch", fetch);
    render(<StartSample />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Load or resume sample event" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/events/${id}/guide`),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1]).toEqual({ method: "GET" });
  });
});
