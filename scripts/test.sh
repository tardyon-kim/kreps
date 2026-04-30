#!/usr/bin/env sh
set -eu
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
docker compose -f infra/compose.yml config
node scripts/check-offline-assets.mjs
