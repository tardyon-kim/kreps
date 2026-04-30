import { describe, expect, it } from "vitest";
import { canTransitionWorkStatus, isValidScope, resolveLocale, supportedThemes } from "./index";

describe("shared package exports", () => {
  it("exports workflow, permission, and locale helpers", () => {
    expect(canTransitionWorkStatus("registered", "assigned")).toBe(true);
    expect(isValidScope("project")).toBe(true);
    expect(resolveLocale({ userLocale: "en" })).toBe("en");
    expect(supportedThemes).toEqual(["system", "light", "dark"]);
  });
});
