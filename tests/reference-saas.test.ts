import { describe, expect, it } from "vitest";
import { canInvite, cancelNotification, retryNotification } from "../apps/reference-saas/lib/store.js";
describe("reference SaaS baseline product rules", () => {
  it("limits invitations to administrators", () => { expect(canInvite("u-admin")).toBe(true); expect(canInvite("u-member")).toBe(false); });
  it("does not retry or cancel an already sent notification", () => { expect(() => retryNotification("n-welcome")).toThrow(/pending/); expect(() => cancelNotification("n-welcome")).toThrow(/Sent/); });
});
