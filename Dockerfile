# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=true
# NEXT_PUBLIC_* are inlined at build time. Pass them per environment:
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://bricks.example.com .
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME="Fly Ash Bricks"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN pnpm build

# Migrations and admin scripts run from this image too (`pnpm db:migrate`),
# so it keeps the full dependency tree and sources; the runtime image does not.
FROM build AS tools
ENV NODE_ENV=production
CMD ["pnpm", "db:migrate"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Mount points for the backups and assets volumes. A new named volume takes
# its owner from these, so the app can write to it without running as root.
RUN mkdir -p /backups /data/assets && chown nextjs:nodejs /backups /data/assets
USER nextjs
EXPOSE 3000
# Heap below the container limit so Node collects instead of being OOM-killed.
CMD ["node", "--enable-source-maps", "--max-old-space-size=768", "server.js"]
