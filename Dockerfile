# syntax=docker/dockerfile:1.7

# ---- Stage 1: install production dependencies only ----
# bookworm-slim (glibc) matches the distroless/debian12 runtime below, so native modules built here still load there.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# ---- Stage 2: minimal, non-root runtime ----
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=deps --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot package.json healthcheck.js ./
COPY --chown=nonroot:nonroot src ./src
USER nonroot
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "/app/healthcheck.js"]
# Node is the distroless entrypoint; node is PID 1 and handles SIGTERM itself (see src/server.js).
CMD ["src/server.js"]
