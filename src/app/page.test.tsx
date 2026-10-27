import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";
import NotFound from "./not-found";

describe("public foundation surfaces, AC-27 and AC-31", () => {
  it("gives preparation navigation a real destination and uses one main landmark", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Keep your event plan consistent",
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(container.querySelector("#prepare")).toBeInTheDocument();
    expect(container.querySelector("#workflow")).toBeInTheDocument();
  });
  it("does not advertise unfinished capabilities or expose internal checks", () => {
    const { container } = render(<Home />);
    expect(container.textContent).not.toMatch(
      /hackathon|prototype|coming soon|demo|proof of concept|MVP/i,
    );
    expect(
      container.querySelector('a[href*="internal"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve|create event/i }),
    ).not.toBeInTheDocument();
  });
  it("offers a working way home from an unknown address", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("link", { name: "Return to EventOps" }),
    ).toHaveAttribute("href", "/");
  });
});
