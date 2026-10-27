import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

describe("route fallback recovery, AC-27", () => {
  it("requests a fresh server render using the framework retry callback", async () => {
    const retry = vi.fn();
    render(
      <ErrorPage error={new Error("private server detail")} retry={retry} />,
    );
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
