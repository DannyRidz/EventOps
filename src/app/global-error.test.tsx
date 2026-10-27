import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("root fallback document, AC-28", () => {
  it("provides its own descriptive title, language and safe recovery content", () => {
    const html = renderToStaticMarkup(
      <GlobalError error={new Error("private root detail")} retry={vi.fn()} />,
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.title).toBe("Unable to open page | EventOps");
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector("main h1")?.textContent).toBe(
      "EventOps couldn’t open this page.",
    );
    expect(document.body.textContent).not.toContain("private root detail");
    expect(document.querySelector("button")?.textContent).toBe("Try again");
  });
});
