import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SignInForm } from "./sign-in-form";
const { navigateAccount } = vi.hoisted(() => ({ navigateAccount: vi.fn() }));
vi.mock("./account-navigation", () => ({ navigateAccount }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("recovers workspace creation without reusing a consumed email code", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace_pending: true }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace_id: "saved" }),
    });
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(
    screen.getByLabelText(/Email address/),
    "synthetic@example.test",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Send email code" }));
  await user.type(
    await screen.findByLabelText(/Six digit email code/),
    "123456",
  );
  await user.click(
    screen.getByRole("button", { name: "Verify and open workspace" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /email is verified/,
  );
  expect(
    screen.queryByLabelText(/Six digit email code/),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Retry opening workspace" }),
  );
  await waitFor(() => expect(navigateAccount).toHaveBeenCalledWith("/events"));
  expect(fetcher.mock.calls[2]?.[0]).toBe("/api/workspace/bootstrap");
});
it("preserves email and shows a retryable send failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message: "Please wait before requesting another code.",
        retry_after_seconds: 60,
      }),
    }),
  );
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(
    screen.getByLabelText(/Email address/),
    "synthetic@example.test",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Send email code" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Please wait/);
  expect(screen.getByLabelText(/Email address/)).toHaveValue(
    "synthetic@example.test",
  );
});

it("opens a fresh workspace after verification, without navigating on invalid codes", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Invalid code" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ redirect: "/events" }),
    });
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(
    screen.getByLabelText(/Email address/),
    "synthetic@example.test",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Send email code" }));
  const code = await screen.findByLabelText(/Six digit email code/);
  await user.type(code, "000000");
  await user.click(
    screen.getByRole("button", { name: "Verify and open workspace" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid code");
  expect(navigateAccount).not.toHaveBeenCalled();
  await user.clear(code);
  await user.type(code, "123456");
  await user.click(
    screen.getByRole("button", { name: "Verify and open workspace" }),
  );
  await waitFor(() =>
    expect(navigateAccount).toHaveBeenCalledExactlyOnceWith("/events"),
  );
});
