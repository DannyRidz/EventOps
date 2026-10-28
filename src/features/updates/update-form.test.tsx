import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateForm } from "./update-form";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("confirmed text boundary", () => {
  it("requires acknowledged text and deliberate confirmation", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "draft",
        raw_text: "Move session",
        corrected_text: "Move session",
        generation: 1,
      }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<UpdateForm eventId="event" baseId="revision" />);
    await user.type(screen.getByLabelText("Organizer update"), "Move session");
    expect(
      screen.queryByText("Confirm text and record analysis request"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save update text" }));
    await waitFor(() =>
      expect(screen.getByText("Saved text generation 1.")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", {
        name: "Confirm text and record analysis request",
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", {
        name: "Confirm text and record analysis request",
      }),
    ).toBeEnabled();
    await user.type(screen.getByLabelText("Organizer update"), " again");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(
      screen.getByRole("button", {
        name: "Confirm text and record analysis request",
      }),
    ).toBeDisabled();
  });
  it("retains unsaved input on service failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    render(<UpdateForm eventId="event" baseId="revision" />);
    await user.type(
      screen.getByLabelText("Organizer update"),
      "Keep this text",
    );
    await user.click(screen.getByRole("button", { name: "Save update text" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(screen.getByLabelText("Organizer update")).toHaveValue(
      "Keep this text",
    );
  });
  it("reports a saved blocked job without suggesting completion", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: "job" }) }),
    );
    render(
      <UpdateForm
        eventId="event"
        baseId="revision"
        initial={{
          id: "draft",
          raw_text: "Original",
          corrected_text: "Corrected",
          generation: 2,
        }}
      />,
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", {
        name: "Confirm text and record analysis request",
      }),
    );
    expect(
      await screen.findByText("Awaiting model access"),
    ).toBeInTheDocument();
    expect(screen.getByText(/No analysis has run/)).toBeInTheDocument();
  });
});
