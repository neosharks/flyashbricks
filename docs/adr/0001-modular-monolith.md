# 0001 — One Next.js app, self-hosted in Docker

**Status:** accepted

## Context

The brief asked for a Node/TypeScript backend, a web frontend, MongoDB, and a
deployment that starts on the owner's own server and may move to a cloud later.
The stack guide warns against running a Next.js app _and_ a separate API
without a reason: two deploys, two auth implementations, two places for bugs.

## Decision

One Next.js (App Router) app. Server Components read MongoDB directly; Server
Actions are the write API; Route Handlers exist only for things that genuinely
need HTTP (auth callbacks, file downloads, CSV export, scheduled jobs, health).

It ships as a standalone Docker image behind Caddy (automatic HTTPS), with
MongoDB, Redis and a tiny scheduler container (`docker-compose.prod.yml`).

## Consequences

- Moving to AWS/any cloud is a matter of running the same image (ECS, App
  Runner, a VM) against Atlas and ElastiCache; nothing is Vercel-specific.
- Scheduled work (outbox drain, nightly backup) is triggered over HTTP with a
  shared secret, so it works the same under Docker, systemd timers, or a
  cloud scheduler.
- If a native mobile app or third-party integration needs a public API later,
  it is added as versioned Route Handlers over the same `features/*` functions.
