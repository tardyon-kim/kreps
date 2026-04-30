import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] ?? "apps/web/dist";
const forbidden = [
  /https?:\/\/[^"')\s]+/gi,
  /(^|["'(=\s])\/\/(?!\/)[^"')\s]+/gi,
];
const allowedReferences = new Set([
  "https://react.dev/errors/",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/XML/1998/namespace",
]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(distDir)) {
  console.log(`offline asset scan skipped: ${distDir} does not exist yet`);
  process.exit(0);
}

const offenders = [];
for (const file of walk(distDir)) {
  if (!/\.(html|js|css|json|svg|webmanifest|xml)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    const matches = content.match(pattern);
    const externalMatches = (matches ?? []).filter((match) => {
      const normalized = match.replace(/^[\s"'(=]+/, "");
      return !allowedReferences.has(normalized);
    });
    if (externalMatches.length > 0) offenders.push(`${file}: ${externalMatches.join(", ")}`);
  }
}

if (offenders.length > 0) {
  console.error("External runtime asset references found:");
  console.error(offenders.join("\n"));
  process.exit(1);
}

console.log("offline asset scan passed");
