import { useCallback, useEffect, useState } from "react";
import type { Locale, ThemePreference } from "@kreps/shared";
import { toLocale, useI18n } from "../../i18n/I18nProvider.js";
import { toTheme, useTheme } from "../../theme/ThemeProvider.js";

type PreferenceState = "loading" | "idle" | "saving" | "error";

type AuthMeResponse = {
  user?: {
    id: string;
    locale: Locale;
    theme: ThemePreference;
  };
};

export function UserSettingsPage() {
  const { dictionary, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [preferenceState, setPreferenceState] = useState<PreferenceState>("loading");

  useEffect(() => {
    if (typeof fetch !== "function") {
      setPreferenceState("error");
      return undefined;
    }

    const controller = new AbortController();

    async function loadProfilePreferences() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          setPreferenceState("error");
          return;
        }

        const body = (await response.json()) as AuthMeResponse;
        if (!body.user) {
          setPreferenceState("error");
          return;
        }

        setUserId(body.user.id);
        setLocale(toLocale(body.user.locale));
        setTheme(toTheme(body.user.theme));
        setPreferenceState("idle");
      } catch {
        if (!controller.signal.aborted) setPreferenceState("error");
      }
    }

    void loadProfilePreferences();

    return () => {
      controller.abort();
    };
  }, [setLocale, setTheme]);

  const persistPreferences = useCallback(
    async (preferences: Partial<{ locale: Locale; theme: ThemePreference }>) => {
      if (!userId || typeof fetch !== "function") {
        setPreferenceState("error");
        return;
      }

      setPreferenceState("saving");
      try {
        const response = await fetch(`/api/users/${userId}/preferences`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(preferences),
        });

        setPreferenceState(response.ok ? "idle" : "error");
      } catch {
        setPreferenceState("error");
      }
    },
    [userId],
  );

  const controlsDisabled = preferenceState === "loading" || preferenceState === "saving" || userId === null;

  return (
    <section className="directory-page">
      <div className="work-home-header">
        <span className="eyebrow">{dictionary.nav.settings}</span>
        <h1>{dictionary.settingsPage.title}</h1>
        <p>{dictionary.settingsPage.subtitle}</p>
      </div>

      <div className="settings-grid">
        <section className="content-panel settings-panel" aria-busy={preferenceState === "loading" || preferenceState === "saving"}>
          <h2>{dictionary.settingsPage.preferencesTitle}</h2>
          <label className="form-field">
            <span>{dictionary.settingsPage.languageLabel}</span>
            <select
              className="select-control"
              aria-label={dictionary.settingsPage.languageLabel}
              value={locale}
              disabled={controlsDisabled}
              onChange={(event) => {
                const nextLocale = toLocale(event.target.value);
                setLocale(nextLocale);
                void persistPreferences({ locale: nextLocale });
              }}
            >
              <option value="ko">{"\ud55c\uad6d\uc5b4"}</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="form-field">
            <span>{dictionary.settingsPage.themeLabel}</span>
            <select
              className="select-control"
              aria-label={dictionary.settingsPage.themeLabel}
              value={theme}
              disabled={controlsDisabled}
              onChange={(event) => {
                const nextTheme = toTheme(event.target.value);
                setTheme(nextTheme);
                void persistPreferences({ theme: nextTheme });
              }}
            >
              <option value="system">{dictionary.theme.system}</option>
              <option value="light">{dictionary.theme.light}</option>
              <option value="dark">{dictionary.theme.dark}</option>
            </select>
          </label>
          <p className="sr-only" role="status">
            {preferenceState === "loading" ? "Loading preferences" : ""}
            {preferenceState === "saving" ? "Saving preferences" : ""}
            {preferenceState === "error" ? "Preference save failed" : ""}
          </p>
        </section>

        <aside className="content-panel">
          <h2>{dictionary.settingsPage.previewTitle}</h2>
          <p className="focus-copy">{dictionary.settingsPage.previewBody}</p>
        </aside>
      </div>
    </section>
  );
}
