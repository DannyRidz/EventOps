import { beforeEach, expect, it } from "vitest";
import { operationKey } from "./request-key";
beforeEach(() => sessionStorage.clear());
it("reuses only the same operation key across a tab reload and stores no submitted content", () => {
  const first = operationKey("approve:proposal:generation1");
  expect(operationKey("approve:proposal:generation1")).toBe(first);
  expect(operationKey("approve:proposal:generation2")).not.toBe(first);
  expect(
    sessionStorage.getItem("eventops:request:approve:proposal:generation1"),
  ).toBe(first);
  expect(first).toMatch(/^[a-f0-9-]{36}$/);
});
