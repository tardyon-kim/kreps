import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isMainModule } from "./run-main.js";

describe("database CLI entrypoint detection", () => {
  it("matches the current entry script through a file URL", () => {
    const entryPath = join(process.cwd(), "src", "db", "migrate.ts");

    expect(isMainModule(pathToFileURL(entryPath).href, ["node", entryPath])).toBe(true);
  });

  it("does not match when the module is imported by another script", () => {
    const modulePath = join(process.cwd(), "src", "db", "migrate.ts");
    const otherPath = join(process.cwd(), "src", "db", "seed.ts");

    expect(isMainModule(pathToFileURL(modulePath).href, ["node", otherPath])).toBe(false);
  });
});
