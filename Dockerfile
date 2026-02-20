# =============================================================================
# Multi-Stage Dockerfile for Stock Trading API
# =============================================================================
# This Dockerfile follows Node.js best practices from goldbergyoni/nodebestpractices
# and the project constitution requirements for Docker deployment.
#
# Build command:
#   docker build -t stock-trading-api:latest .
#
# Run command:
#   docker run -p 3000:3000 --env-file .env stock-trading-api:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Common foundation for all stages
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Builder - Install dependencies and compile TypeScript
# -----------------------------------------------------------------------------
FROM base AS builder

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for TypeScript compilation)
# Use npm ci for reproducible builds (respects package-lock.json exactly)
RUN npm ci

# Copy source code and configuration files
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Remove devDependencies after build (not needed in production)
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 3: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM base AS production

# Set NODE_ENV for production optimization
ENV NODE_ENV=production

# Copy compiled application and production dependencies from builder
# Use --chown to set ownership to node user (non-root)
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Copy non-TypeScript assets (YAML, etc.) from source - app resolves from cwd + path
COPY --from=builder --chown=node:node /app/src/features/shared/infrastructure/http/openapi.yaml ./src/features/shared/infrastructure/http/openapi.yaml

# Switch to non-root user (security best practice)
# The node user is pre-configured in the official Node.js image (UID 1000)
USER node

# Expose application port
# (Note: This is documentation only; actual port mapping done at runtime)
EXPOSE 3000

# Health check configuration
# Checks /health endpoint every 30s with 3s timeout
# Retries 3 times before marking container unhealthy
# Waits 40s after startup before first check (allows DB connection)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
# Node.js 20+ handles signals properly when running as PID 1
# Application has graceful shutdown handlers (SIGTERM/SIGINT)
# Set v8 max heap size to 90% of container memory limit (prevents OOM)
# For 512MB container: --max-old-space-size=460
CMD ["node", "--max-old-space-size=460", "dist/src/index.js"]
