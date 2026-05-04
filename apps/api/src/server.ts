import { buildApp } from "./app.js";
import { PostgresAuthStore } from "./auth/session.js";
import { loadConfig } from "./config.js";
import type { AppConfig } from "./config.js";
import { createDatabaseClient } from "./db/client.js";
import { isMainModule } from "./db/run-main.js";
import { OrganizationService, PostgresOrganizationStore } from "./modules/organizations/organization.service.js";
import { PostgresUserStore, UserService } from "./modules/users/user.service.js";

export function getServerListenOptions(config: AppConfig) {
  return {
    host: config.bindHost,
    port: config.bindPort,
  };
}

if (isMainModule(import.meta.url)) {
  const config = loadConfig();
  const database = createDatabaseClient(config.databaseUrl);
  const app = buildApp(config, {
    authStore: new PostgresAuthStore(database.db),
    organizationService: new OrganizationService(new PostgresOrganizationStore(database.db)),
    userService: new UserService(new PostgresUserStore(database.db)),
  });
  app.addHook("onClose", async () => {
    await database.close();
  });

  await app.listen(getServerListenOptions(config));
}
