import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const distEntry = join(packageRoot, "dist", "index.js");

if (!existsSync(distEntry)) {
  console.error(`Missing runtime entrypoint: ${distEntry}`);
  process.exit(1);
}

const builtModule = await import(pathToFileURL(distEntry).href);

if (!builtModule.canTransitionWorkStatus("registered", "assigned")) {
  console.error("Built workflow export did not allow registered -> assigned.");
  process.exit(1);
}

if (JSON.stringify(builtModule.supportedThemes) !== JSON.stringify(["system", "light", "dark"])) {
  console.error("Built theme export did not match canonical themes.");
  process.exit(1);
}

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

console.log("shared runtime verification passed");
