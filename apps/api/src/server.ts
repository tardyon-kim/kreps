import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AppConfig } from "./config.js";
import { isMainModule } from "./db/run-main.js";

export function getServerListenOptions(config: AppConfig) {
  return {
    host: config.bindHost,
    port: config.bindPort,
  };
}

if (isMainModule(import.meta.url)) {
  const config = loadConfig();
  const app = buildApp(config);
  await app.listen(getServerListenOptions(config));
}
