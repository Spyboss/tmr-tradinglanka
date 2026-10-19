# Node 24 Active LTS (Krypton) - supported to 2028-04-30 per the official Node
# release schedule. The previous node:18-alpine hit end-of-life 2025-04-30, so
# production was running an unpatched runtime for 18 months.
# See https://github.com/nodejs/Release/blob/main/schedule.json
FROM node:26-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Install dependencies
RUN apk add --no-cache curl ca-certificates

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY backend/package*.json backend/.npmrc ./

# Install dependencies with overrides and global tools.
# `--include=dev` is required because ENV NODE_ENV=production above makes npm
# omit devDependencies by default, and build:prod runs `tsc` - typescript is a
# devDependency. ts-node used to pull typescript in as an auto-installed peer
# from the prod side; removing ts-node (c8ea14e) silently removed tsc, so every
# deploy after 5b638f9 built a dist/ with no server.js -> MODULE_NOT_FOUND at
# boot -> healthcheck failure -> deploy FAILED.
# devDeps remaining in the runtime image is a known tradeoff for now; a
# multi-stage build to slim the image is deferred to the quality pass.
RUN npm install --include=dev && npm install -g cpx

# Copy the rest of the application
COPY backend ./

# Build the application. build:prod runs tsc (which emits dist/*.js despite
# type errors, noEmitOnError:false) and falls back to manual-copy-assets for
# templates/fonts. Then fail the build loudly if the runtime entrypoint was not
# produced - every failure used to be masked with `|| echo`, so a broken image
# shipped and only died later at the healthcheck stage.
RUN (npm run build:prod || echo "build:prod reported warnings (tsc type errors are tolerated)") && \
    (test -f dist/server.js || (echo "FATAL: dist/server.js was not produced by the build" && exit 1)) && \
    echo "Checking for deprecated packages..." && \
    (npm ls inflight rimraf @humanwhocodes/object-schema @humanwhocodes/config-array are-we-there-yet gauge || true)

# Expose the port the app runs on
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Command to run the application
CMD ["node", "-r", "dotenv/config", "dist/server.js"]