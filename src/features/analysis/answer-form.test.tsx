import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { AnswerForm } from "./answer-form";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
it("preserves an unsaved answer on failure and sends the frozen question generation", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Connection lost"));
  vi.stubGlobal("fetch", fetch);
  render(
    <AnswerForm
      eventId="event"
      jobId="job"
      digest="digest"
      generation={3}
      questions={["May the workshop start later?"]}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Your answer"), "Yes, 11:15 to 12:15.");
  await user.click(
    screen.getByRole("button", { name: "Save answer and review text" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
  expect(screen.getByLabelText("Your answer")).toHaveValue(
    "Yes, 11:15 to 12:15.",
  );
  const first = JSON.parse(fetch.mock.calls[0]![1].body).idempotency_key;
  await user.click(
    screen.getByRole("button", { name: "Save answer and review text" }),
  );
  expect(JSON.parse(fetch.mock.calls[1]![1].body).idempotency_key).toBe(first);
  expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain("11:15");
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
    generation: 3,
    result_digest: "digest",
    question_index: 0,
    answer: "Yes, 11:15 to 12:15.",
  });
});
