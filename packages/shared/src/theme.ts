export const supportedThemes = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof supportedThemes)[number];

export function isSupportedTheme(theme: string | undefined): theme is ThemePreference {
  return typeof theme === "string" && (supportedThemes as readonly string[]).includes(theme);
}
