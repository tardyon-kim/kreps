import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(packageRoot, "dist");
const distEntry = join(distDir, "index.js");

function runPnpm(args: string[]) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    execFileSync(process.execPath, [npmExecPath, ...args], {
      cwd: packageRoot,
      stdio: "pipe",
    });
    return;
  }

  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    cwd: packageRoot,
    stdio: "pipe",
  });
}

describe("shared package runtime artifact", () => {
  it("builds a Node-consumable ESM entrypoint", async () => {
    rmSync(distDir, { recursive: true, force: true });

    runPnpm(["build"]);

    expect(existsSync(distEntry)).toBe(true);

    const builtModule = await import(`${pathToFileURL(distEntry).href}?${Date.now()}`);
    expect(builtModule.canTransitionWorkStatus("registered", "assigned")).toBe(true);
    expect(builtModule.supportedThemes).toEqual(["system", "light", "dark"]);

    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        [
          'import { canTransitionWorkStatus, supportedThemes } from "@kreps/shared";',
          'if (!canTransitionWorkStatus("registered", "assigned")) process.exit(1);',
          'if (JSON.stringify(supportedThemes) !== JSON.stringify(["system", "light", "dark"])) process.exit(2);',
        ].join("\n"),
      ],
      {
        cwd: packageRoot,
        stdio: "pipe",
      },
    );
  });
});
