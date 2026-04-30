import { describe, expect, it } from "vitest";
import { resolveLocale } from "./i18n";

describe("locale fallback", () => {
  it("prefers the user locale over organization locale", () => {
    expect(resolveLocale({ userLocale: "en", organizationLocale: "ko", defaultLocale: "ko" })).toBe("en");
  });

  it("uses organization locale when user locale is missing", () => {
    expect(resolveLocale({ userLocale: undefined, organizationLocale: "en", defaultLocale: "ko" })).toBe("en");
  });

  it("uses the default locale when user and organization locales are missing", () => {
    expect(resolveLocale({ userLocale: undefined, organizationLocale: undefined, defaultLocale: "ko" })).toBe("ko");
  });
});
