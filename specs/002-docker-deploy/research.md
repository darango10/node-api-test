# Research: Docker Deployment for Node.js

**Feature**: 002-docker-deploy  
**Date**: 2025-02-08  
**Status**: Complete

## Overview

This document captures research findings for containerizing the Stock Trading API using Docker best practices from the Node.js Best Practices repository and the project constitution.

## Research Topics

### 1. Docker Base Image Selection

**Decision**: Use `node:20-alpine` for production image

**Rationale**:
- **Alpine Linux**: Minimal base image (~5MB vs ~120MB for standard Debian)
- **Security**: Smaller attack surface, fewer vulnerabilities
- **Performance**: Faster image pulls, reduced network transfer
- **Node 20**: LTS version, aligns with `package.json` engines requirement (>=20.0.0)
- **Official image**: Maintained by Docker and Node.js team

**Alternatives Considered**:
- `node:20` (Debian-based): Rejected due to larger size (960MB vs 170MB), more vulnerabilities
- `node:20-slim`: Rejected in favor of Alpine for even smaller size
- `distroless/nodejs20`: Considered but Alpine provides better balance of size and compatibility

**Implementation Notes**:
- Use explicit tag `node:20-alpine` (never `latest`)
- Alpine requires `npm ci --omit=dev` for production dependencies
- Some native modules may need build tools in builder stage (`python3`, `make`, `g++`)

### 2. Multi-Stage Build Strategy

**Decision**: Implement 3-stage Dockerfile (base, builder, production)

**Rationale**:
- **Stage 1 (base)**: Common configuration shared by builder and production
- **Stage 2 (builder)**: Install all dependencies (including devDependencies), run TypeScript compilation
- **Stage 3 (production)**: Copy only compiled artifacts and production dependencies
- **Benefits**: Final image excludes TypeScript, tests, dev tools (~50% size reduction)

**Build Process**:
```
base → builder → production
       (dev deps)  (prod deps only)
       (compile TS) (dist/ + node_modules)
```

**Alternatives Considered**:
- Single-stage build: Rejected due to bloated final image (includes devDependencies)
- Two-stage build: Rejected in favor of three-stage for better layer caching

**Implementation Notes**:
- Builder stage: `npm ci` (install all deps), `npm run build` (TypeScript compilation)
- Production stage: `npm ci --omit=dev` (production deps only), `COPY --from=builder dist/`
- Use `.dockerignore` to exclude `node_modules/`, `dist/`, `.git/` from build context

### 3. Security Scanning and Hardening

**Decision**: Integrate Trivy for vulnerability scanning, enforce non-root user

**Rationale**:
- **Trivy**: Open-source, comprehensive (OS + app dependencies), fast, CI-friendly
- **Non-root user**: Alpine image includes `node` user (UID 1000), prevents privilege escalation
- **Scan frequency**: CI/CD pipeline (every build) + scheduled scans (weekly)

**Security Measures**:
1. **Non-root execution**: `USER node` in Dockerfile
2. **No secrets in image**: Enforce via `.dockerignore` (exclude `.env`, `*.key`)
3. **Read-only filesystem**: Run container with `--read-only` flag (app logs to stdout)
4. **Minimal permissions**: File ownership to `node:node`, directories 755, files 644
5. **Dependency scanning**: `npm audit` in CI before Docker build

**Alternatives Considered**:
- Snyk: Rejected due to cost for private repos (Trivy is free)
- Clair: Rejected due to complexity (requires separate server)
- Docker Scout: Considered but Trivy has better Node.js support

**Implementation Notes**:
```dockerfile
# Set ownership for node user
COPY --from=builder --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 4. Docker Compose for Local Development

**Decision**: Provide `docker-compose.yml` with app + MongoDB services

**Rationale**:
- **Local parity**: Matches production container behavior
- **Zero config**: Developers run `docker-compose up` (no manual MongoDB setup)
- **Networking**: Automatic service discovery (`mongodb://mongo:27017`)
- **Persistence**: Named volumes for MongoDB data (survives container restarts)

**Services**:
1. **app**: Build from Dockerfile, expose port 3000, mount `.env` file
2. **mongo**: Official MongoDB image (compatible with `mongoose` 8.8)
3. **mongo-express** (optional): Web UI for MongoDB during development

**Alternatives Considered**:
- Separate MongoDB instructions: Rejected for poor developer experience
- Docker Compose production use: Rejected (production uses orchestrators like Kubernetes)

**Implementation Notes**:
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment: {NODE_ENV: development}
    env_file: .env
    depends_on: [mongo]
  
  mongo:
    image: mongo:7-jammy
    volumes: [mongo-data:/data/db]
    ports: ["27017:27017"]
```

### 5. Memory and Resource Limits

**Decision**: Set Docker memory limit + Node.js `--max-old-space-size`

**Rationale**:
- **Problem**: Node.js defaults to 4GB heap, Docker default is unlimited
- **Risk**: OOM kills without graceful degradation
- **Solution**: Docker limit (e.g., 512MB) + v8 flag (e.g., `--max-old-space-size=460`)
- **Rule**: v8 limit = 90% of Docker limit (10% for overhead)

**Alternatives Considered**:
- Docker limit only: Rejected (v8 doesn't know Docker limit, still allocates default heap)
- v8 limit only: Rejected (doesn't prevent container from exceeding host resources)

**Implementation Notes**:
```dockerfile
# For 512MB container
CMD ["node", "--max-old-space-size=460", "dist/index.js"]
```
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits: {memory: 512M}
```

### 6. Health Checks in Docker

**Decision**: Use `HEALTHCHECK` instruction with `/health` endpoint

**Rationale**:
- **Kubernetes/orchestrators**: Read Docker HEALTHCHECK for liveness probes
- **Early detection**: Container marked unhealthy if endpoint fails
- **Graceful shutdown**: Orchestrator stops routing traffic before restart

**Health Check Configuration**:
- **Endpoint**: `GET /health` (already implemented in `src/infrastructure/http/routes/health.routes.ts`)
- **Interval**: 30s (balance between responsiveness and load)
- **Timeout**: 3s (enough for simple health check)
- **Retries**: 3 (avoid false positives from transient issues)
- **Start period**: 40s (allow app startup + DB connection)

**Alternatives Considered**:
- External health checks only: Rejected (Docker native support is simpler)
- TCP check on port 3000: Rejected (doesn't verify app logic, only port binding)

**Implementation Notes**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
```

### 7. Non-Root User Execution

**Decision**: Use `node` user (UID 1000) from official Node.js image

**Rationale**:
- **Security**: Prevents privilege escalation exploits
- **Constitution requirement**: Docker section mandates non-root
- **Official image**: `node:alpine` includes pre-configured `node` user
- **File access**: `/app` directory owned by `node:node`

**Alternatives Considered**:
- Custom user creation: Rejected (official image already provides `node` user)
- Root user: Rejected (violates constitution and security best practices)

**Implementation Notes**:
```dockerfile
# After COPY commands, switch to node user
WORKDIR /app
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
USER node
```

### 8. Build Optimization and Layer Caching

**Decision**: Optimize layer order and use BuildKit caching

**Rationale**:
- **Layer caching**: Docker caches unchanged layers, speeds up rebuilds
- **Order matters**: Least-changing files first (package*.json before source code)
- **BuildKit**: Parallel stage execution, better caching, secrets management

**Layer Order Strategy**:
1. Base OS packages (rarely change)
2. `package.json` + `package-lock.json` (change when dependencies update)
3. `npm ci` (cached if lockfile unchanged)
4. Source code `COPY` (changes most frequently)
5. `npm run build` (re-runs only if source changed)

**Alternatives Considered**:
- Copy all files at once: Rejected (invalidates cache on any file change)
- Manual dependency management: Rejected (error-prone, BuildKit is standard)

**Implementation Notes**:
```dockerfile
# Good: Dependency installation cached separately
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Bad: Everything invalidated on any change
COPY . .
RUN npm ci && npm run build
```

**BuildKit Usage**:
```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1
docker build -t stock-trading-api:latest .
```

### 9. .dockerignore Patterns

**Decision**: Comprehensive `.dockerignore` excluding dev files and secrets

**Rationale**:
- **Security**: Prevent `.env`, `.env.local`, secrets from leaking into image
- **Build speed**: Exclude `node_modules/`, `dist/`, `.git/` from build context (faster uploads)
- **Size reduction**: Multi-stage build discards excluded files anyway, but reduces context size

**Critical Exclusions**:
1. **Secrets**: `.env*`, `*.key`, `*.pem`, `secrets/`
2. **Build artifacts**: `node_modules/`, `dist/`, `build/`, `coverage/`
3. **Version control**: `.git/`, `.gitignore`, `.github/`
4. **Development**: `*.log`, `.DS_Store`, `npm-debug.log`, `tests/`, `docs/`
5. **Docker files**: `Dockerfile`, `docker-compose.yml`, `.dockerignore` itself

**Alternatives Considered**:
- Minimal `.dockerignore`: Rejected (security risk, slower builds)
- No `.dockerignore`: Rejected (definitely includes secrets and bloats context)

**Implementation Notes**:
See `.dockerignore` template in contracts/ section below.

### 10. Dockerfile Linting (hadolint)

**Decision**: Integrate `hadolint` in CI pipeline with `.hadolint.yaml` config

**Rationale**:
- **Best practices**: Enforces Dockerfile conventions (pin versions, use `COPY` not `ADD`, etc.)
- **Security**: Detects common mistakes (missing `USER`, unpinned tags)
- **CI integration**: Fails build on errors, warns on style issues
- **Constitution requirement**: Docker section mandates `hadolint`

**Hadolint Rules**:
- **DL3008**: Pin versions in apt-get install
- **DL3018**: Pin versions in apk add (Alpine)
- **DL3025**: Use JSON notation for CMD/ENTRYPOINT
- **DL3059**: Multiple consecutive RUN commands
- **DL4006**: Set SHELL option -o pipefail
- **SC2046**: Quote to prevent word splitting (from ShellCheck)

**Alternatives Considered**:
- Manual code review: Rejected (error-prone, not automated)
- Docker Build warnings: Rejected (incomplete coverage compared to hadolint)

**Implementation Notes**:
```yaml
# .hadolint.yaml
ignored:
  - DL3059  # Allow multiple RUN for clarity in multi-stage builds

trustedRegistries:
  - docker.io

max-line-length: 120
```

```bash
# CI command
docker run --rm -i hadolint/hadolint < Dockerfile
```

## Summary of Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| Base Image | `node:20-alpine` | Small size (170MB), LTS support, official image |
| Build Strategy | 3-stage multi-stage | Separates build tools from production, 50% size reduction |
| Security Scanning | Trivy + non-root user | Free, comprehensive, CI-friendly, constitution-compliant |
| Local Development | Docker Compose (app + MongoDB) | Zero-config local parity with production |
| Resource Limits | Docker 512MB + v8 460MB | Prevents OOM, graceful degradation |
| Health Checks | `HEALTHCHECK` with `/health` endpoint | Orchestrator integration, early failure detection |
| User | `node` (UID 1000) | Security best practice, constitution requirement |
| Build Optimization | Layer caching + BuildKit | Faster rebuilds, parallel stages |
| `.dockerignore` | Comprehensive exclusions | Security (no secrets), speed (small context) |
| Linting | hadolint in CI | Automated best practices enforcement |

## Next Steps

1. **Phase 1**: Generate `data-model.md` (minimal - Docker config entities)
2. **Phase 1**: Create `contracts/` with Dockerfile, docker-compose.yml, .dockerignore, .hadolint.yaml
3. **Phase 1**: Create `quickstart.md` with build/run instructions
4. **Phase 1**: Update agent context with Docker/containerization knowledge
