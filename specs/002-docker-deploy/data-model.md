# Data Model: Docker Deployment

**Feature**: 002-docker-deploy  
**Date**: 2025-02-08

## Overview

This feature focuses on containerization infrastructure, not application data. The data model here describes Docker configuration entities and their relationships.

## Configuration Entities

### 1. Container Image

**Entity**: Docker Image  
**Purpose**: Deployable artifact containing the compiled application and runtime dependencies

**Properties**:
- **name**: `stock-trading-api` (repository name)
- **tag**: Semantic version or commit SHA (e.g., `1.0.0`, `abc123f`)
- **base_image**: `node:20-alpine`
- **size**: ~170MB (optimized with multi-stage build)
- **layers**: Multiple (base OS, dependencies, application code)
- **user**: `node` (UID 1000, non-root)
- **entrypoint**: `node dist/index.js` with optional v8 flags

**Relationships**:
- Built FROM `node:20-alpine` base image
- Consumed BY container runtime (Docker, Kubernetes, etc.)
- Scanned BY Trivy for vulnerabilities

**Validation Rules**:
- MUST include explicit tag (never `latest`)
- MUST run as non-root user (`USER node`)
- MUST NOT contain secrets (`.env`, `*.key` excluded via `.dockerignore`)
- MUST pass `hadolint` linting
- MUST pass Trivy security scan (no critical vulnerabilities)

**State Transitions**:
```
[Source Code] --docker build--> [Image:tag] --docker run--> [Container]
                                     |
                                     v
                              [Registry Push] --deploy--> [Cloud Runtime]
```

---

### 2. Build Context

**Entity**: Docker Build Context  
**Purpose**: Set of files sent to Docker daemon for image building

**Properties**:
- **root**: Repository root directory
- **included_files**: `src/`, `package*.json`, `tsconfig*.json`
- **excluded_files**: See `.dockerignore` (secrets, `node_modules/`, `.git/`, etc.)
- **size**: ~5MB (after exclusions, before build)

**Relationships**:
- Filtered BY `.dockerignore` rules
- Consumed BY Docker build process

**Validation Rules**:
- MUST exclude secrets via `.dockerignore`
- SHOULD exclude development files (`tests/`, `docs/`)
- SHOULD be < 10MB for fast uploads to Docker daemon

---

### 3. Runtime Configuration

**Entity**: Container Runtime Environment  
**Purpose**: Environment variables and settings provided at container start

**Properties** (from `.env.example`):
- **NODE_ENV**: `production` | `development` | `test`
- **PORT**: Integer (1-65535), default 3000
- **MONGODB_URI**: MongoDB connection string (external service)
- **VENDOR_API_URL**: External stock vendor API URL
- **VENDOR_API_KEY**: External API authentication token
- **LOG_LEVEL**: `fatal` | `error` | `warn` | `info` | `debug` | `trace`
- **SMTP_***: Email configuration (optional)
- **REPORT_RECIPIENTS**: Email list for daily reports (optional)

**Relationships**:
- Validated BY `src/infrastructure/config/index.ts` (Zod schema)
- Consumed BY application at startup
- Provided BY deployer (docker-compose, Kubernetes secrets, etc.)

**Validation Rules** (enforced by Zod schema in config):
- `NODE_ENV` MUST be one of `development`, `production`, `test`
- `PORT` MUST be valid port number (1-65535)
- `MONGODB_URI` MUST be valid URL
- `VENDOR_API_URL` MUST be valid URL
- Missing required config MUST cause startup failure (fail-fast)

**State Transitions**:
```
[.env file] --docker run--> [Environment Variables] --validated--> [Application Config]
                                                          |
                                                      [Invalid]
                                                          v
                                                  [Startup Failure]
```

---

### 4. Docker Compose Stack

**Entity**: Multi-Container Application  
**Purpose**: Orchestrate app container + MongoDB for local development

**Services**:
1. **app**:
   - Build from Dockerfile
   - Expose port 3000
   - Mount `.env` file for configuration
   - Depends on `mongo` service

2. **mongo**:
   - Official MongoDB 7 image
   - Persist data via named volume
   - Expose port 27017 (optional, for external tools)

**Properties**:
- **network**: Default bridge network (automatic service discovery)
- **volumes**: `mongo-data` (persistent MongoDB storage)
- **restart_policy**: `unless-stopped` (auto-restart on failure)

**Relationships**:
- **app** depends on **mongo** (startup order)
- **app** connects to **mongo** via `mongodb://mongo:27017`

**Validation Rules**:
- `docker-compose up` MUST start both services
- MongoDB data MUST persist across container restarts (named volume)
- App MUST be reachable at `http://localhost:3000`

---

### 5. Health Check

**Entity**: Container Health Status  
**Purpose**: Monitor application readiness and liveness

**Properties**:
- **endpoint**: `GET /health`
- **interval**: 30 seconds
- **timeout**: 3 seconds
- **retries**: 3 attempts
- **start_period**: 40 seconds (allow startup time)

**States**:
- **starting**: Initial state, health check not yet active
- **healthy**: Last N health checks succeeded
- **unhealthy**: Last N health checks failed

**Relationships**:
- Executed BY Docker daemon
- Consumed BY orchestrators (Kubernetes liveness/readiness probes)

**Validation Rules**:
- Endpoint MUST return 200 status code
- Response time MUST be < 3 seconds
- MUST verify database connectivity (existing `/health` endpoint checks MongoDB)

**State Transitions**:
```
[starting] --first check after start_period--> [healthy] or [unhealthy]
                                                    |
                                               [periodic checks]
                                                    |
                                         [healthy] <--> [unhealthy]
                                                          |
                                                    [retries exceeded]
                                                          v
                                                  [Container Restart]
```

---

## Configuration Files

### Dockerfile

**Purpose**: Multi-stage build definition  
**Stages**:
1. **base**: Common base for builder and production (Node.js 20 Alpine)
2. **builder**: Install all deps + compile TypeScript
3. **production**: Copy dist/ + production deps only

**Key Directives**:
- `FROM node:20-alpine AS base`
- `USER node` (non-root execution)
- `HEALTHCHECK` (container health monitoring)
- `CMD ["node", "--max-old-space-size=460", "dist/index.js"]`

---

### docker-compose.yml

**Purpose**: Local development orchestration  
**Version**: 3.8  
**Services**: app, mongo  
**Volumes**: mongo-data (persistent storage)  
**Networks**: Default bridge (auto-created)

---

### .dockerignore

**Purpose**: Exclude files from build context  
**Categories**:
- Secrets: `.env*`, `*.key`, `*.pem`
- Build artifacts: `node_modules/`, `dist/`, `coverage/`
- Version control: `.git/`, `.github/`
- Development: `tests/`, `docs/`, `*.log`

---

### .hadolint.yaml

**Purpose**: Dockerfile linting configuration  
**Rules**: Enforce best practices (pin versions, use COPY, etc.)  
**Ignored Rules**: DL3059 (allow multiple RUN for clarity)

---

## Deployment Targets

### Local Development
- **Runtime**: Docker Desktop or Docker Engine
- **Command**: `docker-compose up`
- **Purpose**: Developer testing with MongoDB

### CI/CD Pipeline
- **Runtime**: GitHub Actions, GitLab CI, or similar
- **Commands**: `docker build`, `hadolint`, `trivy scan`
- **Purpose**: Automated testing and security scanning

### Cloud Production
- **Runtime**: Kubernetes, ECS, Cloud Run, etc.
- **Configuration**: Kubernetes manifests or cloud-specific config
- **Scaling**: Horizontal pod autoscaling (stateless app)

---

## No Application Data Changes

**Important**: This feature does NOT modify the application's domain data model (Portfolio, Stock, Transaction entities remain unchanged). The data model here describes Docker infrastructure configuration only.
