import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function isMainModule(moduleUrl: string, argv: readonly string[] = process.argv) {
  const entryPath = argv[1];
  if (!entryPath) return false;

  return pathToFileURL(resolve(entryPath)).href === moduleUrl;
}
