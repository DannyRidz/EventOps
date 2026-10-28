import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportUpload, ImportCorrection } from "./import-form";
import { parseCsv } from "./csv";
import { initialMapping, type ImportTable } from "./model";
import { fixtureSetup } from "@/features/plans/fixtures";
const push = vi.fn(),
  refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("CSV import controls", () => {
  it("submits selected files through the upload action and opens its private batch", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "batch", repeated_file: false }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ImportUpload eventId="event" generation={1} />);
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText("rooms.csv", { exact: true }),
      new File(["room_id,name,location\nR,Hall,Main"], "rooms.csv", {
        type: "text/csv",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Upload for private review" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/events/event/imports/batch"),
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("keeps failed uploads selected and describes retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Correct row 2 in rooms.csv." }),
      }),
    );
    render(<ImportUpload eventId="event" generation={1} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("rooms.csv", {
      exact: true,
    }) as HTMLInputElement;
    await user.upload(
      input,
      new File(["bad"], "rooms.csv", { type: "text/csv" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Upload for private review" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Correct row 2");
    expect(input.files?.[0]?.name).toBe("rooms.csv");
  });
  it("requires an explicit duplicate decision and saved corrections before staging", async () => {
    const p = parseCsv("room_id,name,location\nR,Hall,Main\nR,Hall,Main");
    const t: ImportTable = {
      ...p,
      collection: "rooms",
      filename: "rooms.csv",
      sha256: "a".repeat(64),
      mapping: initialMapping("rooms", p.headers),
      excluded: [],
      keep_one: [],
      offsets: {},
    };
    render(
      <ImportCorrection
        eventId="event"
        batchId="batch"
        generation={1}
        draftGeneration={1}
        initial={[t]}
        originals={[]}
        setup={fixtureSetup}
        locked={false}
      />,
    );
    const user = userEvent.setup();
    expect(
      screen.getByRole("button", { name: "Check and review starting plan" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Keep one/ }));
    expect(screen.getByRole("status")).toHaveTextContent("not been saved");
    expect(
      screen.getByRole("button", { name: "Save corrections" }),
    ).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /I reviewed/ })).toBeDisabled();
  });
});
