import { describe, expect, it } from "vitest";
import { isSupportedTheme, supportedThemes } from "./theme";

describe("theme preferences", () => {
  it("defines the canonical theme preferences", () => {
    expect(supportedThemes).toEqual(["system", "light", "dark"]);
  });

  it("validates theme preference strings from API input", () => {
    expect(isSupportedTheme("dark")).toBe(true);
    expect(isSupportedTheme("solarized")).toBe(false);
  });
});
