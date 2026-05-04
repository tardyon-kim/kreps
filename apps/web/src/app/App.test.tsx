import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dictionaries } from "../i18n/dictionaries.js";
import { App } from "./App.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App routes", () => {
  it("renders the organization screen", () => {
    window.history.pushState({}, "", "/organization");

    render(<App />);

    expect(screen.getByRole("heading", { name: dictionaries.ko.organizationPage.title, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("\ubcf8\uc0ac")).toHaveLength(2);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
    expect(screen.getByText(dictionaries.ko.roles.systemAdmin)).toBeInTheDocument();
    expect(screen.getByText(dictionaries.ko.roles.organizationAdmin)).toBeInTheDocument();
    expect(screen.queryByText("system_admin")).not.toBeInTheDocument();
    expect(screen.queryByText("organization_admin")).not.toBeInTheDocument();
  });

  it("updates the shell language from the settings screen without refresh", async () => {
    const user = userEvent.setup();
    stubProfileFetch({
      id: "00000000-0000-4000-8000-000000000103",
      locale: "ko",
      theme: "system",
    });
    window.history.pushState({}, "", "/settings");

    render(<App />);

    expect(screen.queryByLabelText(dictionaries.ko.app.language)).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByLabelText(dictionaries.ko.settingsPage.languageLabel)).toBeEnabled());
    await user.selectOptions(screen.getByLabelText(dictionaries.ko.settingsPage.languageLabel), "en");

    expect(screen.getByRole("heading", { name: "User Settings", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Work" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("updates the theme from the settings screen", async () => {
    const user = userEvent.setup();
    const userId = "00000000-0000-4000-8000-000000000103";
    stubProfileFetch({
      id: userId,
      locale: "ko",
      theme: "system",
    });
    const fetchMock = vi.mocked(fetch);
    window.history.pushState({}, "", "/settings");

    render(<App />);

    await waitFor(() => expect(screen.getByLabelText(dictionaries.ko.settingsPage.themeLabel)).toBeEnabled());
    await user.selectOptions(screen.getByLabelText(dictionaries.ko.settingsPage.themeLabel), "dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("dark");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/users/${userId}/preferences`,
        expect.objectContaining({
          method: "PATCH",
          credentials: "include",
          body: JSON.stringify({ theme: "dark" }),
        }),
      ),
    );
  });

  it("loads and persists settings through the preferences API", async () => {
    const user = userEvent.setup();
    const userId = "00000000-0000-4000-8000-000000000103";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/auth/me") {
        return new Response(
          JSON.stringify({
            user: {
              id: userId,
              locale: "en",
              theme: "dark",
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (input === `/api/users/${userId}/preferences`) {
        return new Response(JSON.stringify({ user: { id: userId, locale: "ko", theme: "dark" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/settings");

    render(<App />);

    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(document.documentElement.dataset.themePreference).toBe("dark");
    expect(screen.getByLabelText(dictionaries.en.settingsPage.languageLabel)).toBeEnabled();

    await user.selectOptions(screen.getByLabelText(dictionaries.en.settingsPage.languageLabel), "ko");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/users/${userId}/preferences`,
        expect.objectContaining({
          method: "PATCH",
          credentials: "include",
          body: JSON.stringify({ locale: "ko" }),
        }),
      ),
    );
  });

  it("keeps settings controls disabled when profile loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401 })));
    window.history.pushState({}, "", "/settings");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Preference save failed"));
    expect(screen.getByLabelText(dictionaries.ko.settingsPage.languageLabel)).toBeDisabled();
    expect(screen.getByLabelText(dictionaries.ko.settingsPage.themeLabel)).toBeDisabled();
  });

  it("falls back to the my work home for unknown routes", () => {
    window.history.pushState({}, "", "/unknown");

    render(<App />);

    expect(screen.getByRole("heading", { name: dictionaries.ko.home.title, level: 1 })).toBeInTheDocument();
  });
});

function stubProfileFetch(user: { id: string; locale: "ko" | "en"; theme: "system" | "light" | "dark" }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (input === "/api/auth/me") {
        return new Response(JSON.stringify({ user }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (input === `/api/users/${user.id}/preferences`) {
        return new Response(JSON.stringify({ user }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    }),
  );
}
