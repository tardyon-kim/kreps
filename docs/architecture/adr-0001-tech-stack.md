# ADR 0001: Initial Work OS Technology Stack

## Status

Accepted on 2026-04-30.

## Decision

Use a TypeScript monorepo with React/Vite for the web client, Fastify for the API, Drizzle ORM for PostgreSQL access, and Docker Compose for on-premise deployment.

## Rationale

The system must run on an internal network, avoid runtime CDN dependencies, support future Gitea migration, and remain easy to deploy by copying a release package to a company server. A split web/API structure keeps the UI responsive and lets the API own audit, RBAC, workflow, and file rules. Drizzle keeps database migrations explicit and reviewable.

## Consequences

All build, test, database, backup, and release commands must be local scripts, so GitHub Actions and Gitea Actions can both call the same commands. The web app must bundle all static assets. The API must keep AI/Agent Runner integration behind configuration and safe disabled defaults.
