import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { VoiceRecorder } from "./voice-recorder";
import { UpdateForm } from "@/features/updates/update-form";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const instances: FakeRecorder[] = [];
const trackStop = vi.fn();
class FakeRecorder {
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["audio"]) });
      this.onstop?.();
    });
  }
}
beforeEach(() => {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: trackStop }],
      })),
    },
  });
  URL.createObjectURL = vi.fn(() => "blob:local");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("recording and text fallback, AC-10", () => {
  it("denied permission retains the complete text path", async () => {
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(
      new Error("denied"),
    );
    const user = userEvent.setup();
    render(
      <>
        <VoiceRecorder eventId="event" />
        <UpdateForm eventId="event" baseId="revision" />
      </>,
    );
    await user.type(
      screen.getByLabelText("Organizer update"),
      "Keep this work",
    );
    await user.click(screen.getByRole("button", { name: "Start recording" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "type the complete update",
    );
    expect(screen.getByLabelText("Organizer update")).toHaveValue(
      "Keep this work",
    );
  });
  it("supports stop and local playback but no upload while access is disabled", async () => {
    const user = userEvent.setup();
    render(<VoiceRecorder eventId="event" />);
    await user.click(screen.getByRole("button", { name: "Start recording" }));
    await user.click(
      await screen.findByRole("button", { name: "Stop recording" }),
    );
    expect(await screen.findByLabelText("Play your recording")).toHaveAttribute(
      "src",
      "blob:local",
    );
    expect(
      screen.getByRole("button", { name: "Save recording for transcription" }),
    ).toBeDisabled();
    expect(trackStop).toHaveBeenCalled();
  });
  it("discard while recording does not restore a blob in onstop", async () => {
    const user = userEvent.setup();
    render(<VoiceRecorder eventId="event" />);
    await user.click(screen.getByRole("button", { name: "Start recording" }));
    await user.click(
      await screen.findByRole("button", { name: "Discard local recording" }),
    );
    await waitFor(() => expect(instances.at(-1)?.state).toBe("inactive"));
    expect(
      screen.queryByLabelText("Play your recording"),
    ).not.toBeInTheDocument();
  });
  it("preserves playback and permits retry after a lost upload response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    const { rerender } = render(<VoiceRecorder eventId="event" enabled />);
    await user.click(screen.getByRole("button", { name: "Start recording" }));
    await user.click(
      await screen.findByRole("button", { name: "Stop recording" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Save recording for transcription",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    rerender(
      <VoiceRecorder
        eventId="event"
        enabled
        jobs={[
          {
            id: "job",
            state: "uploading",
            draft_id: null,
            audio_deleted_at: null,
            delete_after: "2026-10-29",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Save recording for transcription" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Play your recording")).toBeInTheDocument();
  });
  it("reports incomplete audio deletion", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ audio_deleted: false }),
      }),
    );
    render(
      <VoiceRecorder
        eventId="event"
        jobs={[
          {
            id: "job",
            state: "completed",
            draft_id: "draft",
            audio_deleted_at: null,
            delete_after: "2026-10-29",
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete audio" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Retry deletion",
    );
  });
});
