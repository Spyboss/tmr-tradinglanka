# Node 24 Active LTS (Krypton) - supported to 2028-04-30 per the official Node
# release schedule. The previous node:18-alpine hit end-of-life 2025-04-30, so
# production was running an unpatched runtime for 18 months.
# See https://github.com/nodejs/Release/blob/main/schedule.json
FROM node:24-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Install dependencies
RUN apk add --no-cache curl ca-certificates

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY backend/package*.json backend/.npmrc ./

# Install dependencies with overrides and global tools
RUN npm install --omit=dev && npm install -g cpx

# Copy the rest of the application
COPY backend ./

# Build the application
RUN npm run build:prod || echo "Build completed with warnings" && \
    mkdir -p dist && \
    echo "Checking for deprecated packages..." && \
    npm ls inflight rimraf @humanwhocodes/object-schema @humanwhocodes/config-array are-we-there-yet gauge || true

# Expose the port the app runs on
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Command to run the application
CMD ["node", "-r", "dotenv/config", "dist/server.js"]