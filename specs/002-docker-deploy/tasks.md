---
description: "Task list for Docker deployment implementation"
---

# Tasks: Deploy Service in a Container

**Input**: Design documents from `/specs/002-docker-deploy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Feature Branch**: `002-docker-deploy`
**Feature Type**: Infrastructure (Docker containerization of existing Node.js API)
**Tests**: Not required (infrastructure deployment validation via manual testing)

**Organization**: Tasks are grouped by user story to enable independent validation of each deployment capability.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: Docker files at repository root
- **Documentation**: Update existing README.md with Docker instructions
- All Docker configuration files exist in `specs/002-docker-deploy/contracts/`

---

## Phase 1: Setup (Docker Infrastructure Files)

**Purpose**: Copy Docker configuration from contracts/ to repository root and prepare for implementation

- [ ] T001 Copy Dockerfile from specs/002-docker-deploy/contracts/Dockerfile to repository root
- [ ] T002 [P] Copy docker-compose.yml from specs/002-docker-deploy/contracts/docker-compose.yml to repository root
- [ ] T003 [P] Copy .dockerignore from specs/002-docker-deploy/contracts/.dockerignore to repository root
- [ ] T004 [P] Copy .hadolint.yaml from specs/002-docker-deploy/contracts/.hadolint.yaml to repository root
- [ ] T005 Verify .env.example exists and contains all required Docker environment variables

---

## Phase 2: User Story 1 - Build a Runnable Container Image (Priority: P1) 🎯 MVP

**Goal**: Produce a single runnable container image from the project that can be deployed consistently across all environments.

**Independent Test**: Run `docker build -t stock-trading-api:test .` from repository root; image builds successfully without errors and is tagged.

**Acceptance Criteria**:
- Docker build completes successfully from clean repository
- Image is properly tagged (not using `latest`)
- Build is reproducible (same source = same artifact)
- Multi-stage build produces minimal production image (~170MB)

### Implementation for User Story 1

**Dockerfile Validation**:
- [ ] T010 [US1] Validate Dockerfile at repository root passes hadolint linting
- [ ] T011 [US1] Verify Dockerfile uses multi-stage build (base, builder, production stages)
- [ ] T012 [US1] Verify Dockerfile uses node:20-alpine base image
- [ ] T013 [US1] Verify Dockerfile runs as non-root user (USER node)
- [ ] T014 [US1] Verify Dockerfile includes HEALTHCHECK instruction with /health endpoint

**Build Process**:
- [ ] T015 [US1] Build image with explicit tag: `docker build -t stock-trading-api:1.0.0 .`
- [ ] T016 [US1] Verify build completes within 5 minutes on clean build
- [ ] T017 [US1] Verify final image size is approximately 170MB (check with `docker images`)
- [ ] T018 [US1] Verify image contains only production files (no devDependencies, tests, or .git)

**Build Reproducibility**:
- [ ] T019 [US1] Build image twice from same source and compare digests
- [ ] T020 [US1] Verify .dockerignore excludes secrets (.env, *.key), node_modules, dist, .git

**Image Inspection**:
- [ ] T021 [US1] Inspect image history: `docker history stock-trading-api:1.0.0`
- [ ] T022 [US1] Verify no secrets in image layers
- [ ] T023 [US1] Verify image entrypoint is `dumb-init`
- [ ] T024 [US1] Verify CMD includes `node dist/index.js` with v8 memory flag

**Checkpoint**: At this point, a buildable container image exists and can be distributed to any environment.

---

## Phase 3: User Story 2 - Run the Service with One Command (Priority: P2)

**Goal**: Enable running the service with a single standard docker run command that works the same locally and in production.

**Independent Test**: Run `docker run -p 3000:3000 --env-file .env stock-trading-api:1.0.0`; service starts and responds to health checks.

**Acceptance Criteria**:
- Service starts with one docker run command
- Health endpoint responds within 30 seconds
- Graceful shutdown on docker stop (completes within 30s)

### Implementation for User Story 2

**Single-Command Run**:
- [ ] T030 [US2] Create .env file from .env.example for testing
- [ ] T031 [US2] Start container: `docker run -d -p 3000:3000 --env-file .env --name api-test stock-trading-api:1.0.0`
- [ ] T032 [US2] Verify container status is "running": `docker ps`
- [ ] T033 [US2] Wait 40 seconds for startup period (allow MongoDB connection)

**Health Check Validation**:
- [ ] T034 [US2] Verify health endpoint responds: `curl http://localhost:3000/health`
- [ ] T035 [US2] Verify metrics endpoint responds: `curl http://localhost:3000/metrics`
- [ ] T036 [US2] Check container health status: `docker inspect --format='{{.State.Health.Status}}' api-test`
- [ ] T037 [US2] Verify health status is "healthy" after startup period

**Graceful Shutdown**:
- [ ] T038 [US2] Send stop signal: `docker stop api-test`
- [ ] T039 [US2] Verify container stops within 30 seconds (no forced kill)
- [ ] T040 [US2] Check logs for graceful shutdown message: `docker logs api-test`
- [ ] T041 [US2] Remove test container: `docker rm api-test`

**Checkpoint**: Single-command run works and service behavior matches non-containerized version.

---

## Phase 4: User Story 3 - Configure via Environment (Priority: P3)

**Goal**: Validate that the same image works across dev, staging, and production with only environment variable changes.

**Independent Test**: Run same image with different PORT and MONGODB_URI values; service respects the configuration.

**Acceptance Criteria**:
- Same image runs with different configurations
- Invalid configuration causes fast failure with clear error
- No secrets baked into image

### Implementation for User Story 3

**Environment Configuration**:
- [ ] T050 [US3] Run container with custom PORT: `docker run -d -p 4000:4000 -e PORT=4000 --env-file .env --name api-port-test stock-trading-api:1.0.0`
- [ ] T051 [US3] Verify service responds on port 4000: `curl http://localhost:4000/health`
- [ ] T052 [US3] Stop and remove container: `docker stop api-port-test && docker rm api-port-test`

**Configuration Validation**:
- [ ] T053 [US3] Run container with missing required env var (remove MONGODB_URI from .env)
- [ ] T054 [US3] Verify container fails fast with clear error message
- [ ] T055 [US3] Check logs show validation error: `docker logs <container-id>`

**Secret Safety**:
- [ ] T056 [US3] Inspect image for secrets: `docker history stock-trading-api:1.0.0`
- [ ] T057 [US3] Verify no .env files in image layers
- [ ] T058 [US3] Verify no hardcoded API keys or passwords in image

**Multi-Environment Simulation**:
- [ ] T059 [US3] Create .env.dev and .env.prod with different configurations
- [ ] T060 [US3] Run same image with .env.dev: `docker run --env-file .env.dev ...`
- [ ] T061 [US3] Run same image with .env.prod: `docker run --env-file .env.prod ...`
- [ ] T062 [US3] Verify both containers use their respective configurations

**Checkpoint**: Configuration external to image works correctly; same image is environment-agnostic.

---

## Phase 5: User Story 4 - Run Locally for Testing (Priority: P2)

**Goal**: Enable developers to run the entire stack (app + MongoDB) locally with docker-compose up.

**Independent Test**: Run `docker-compose up` from repository root; API and MongoDB start, API responds to requests.

**Acceptance Criteria**:
- docker-compose up starts both services
- API is reachable at http://localhost:3000
- MongoDB data persists across restarts

### Implementation for User Story 4

**Docker Compose Setup**:
- [ ] T070 [US4] Verify docker-compose.yml exists at repository root
- [ ] T071 [US4] Verify docker-compose.yml defines app and mongo services
- [ ] T072 [US4] Verify docker-compose.yml uses named volumes for MongoDB persistence

**Local Stack Startup**:
- [ ] T073 [US4] Start services: `docker-compose up -d`
- [ ] T074 [US4] Verify both containers are running: `docker-compose ps`
- [ ] T075 [US4] Wait for services to be healthy (check docker-compose ps STATUS column)

**API Connectivity**:
- [ ] T076 [US4] Verify API health endpoint: `curl http://localhost:3000/health`
- [ ] T077 [US4] Verify API responds to stock listing: `curl http://localhost:3000/api/stocks`
- [ ] T078 [US4] Verify API logs show MongoDB connection success

**MongoDB Connectivity**:
- [ ] T079 [US4] Verify MongoDB is accessible from app container
- [ ] T080 [US4] Verify app container can resolve `mongo` hostname (Docker DNS)
- [ ] T081 [US4] Optional: Connect to MongoDB with Compass (mongodb://localhost:27017)

**Data Persistence**:
- [ ] T082 [US4] Create test data via API (POST /api/stocks or similar)
- [ ] T083 [US4] Stop services: `docker-compose down`
- [ ] T084 [US4] Start services again: `docker-compose up -d`
- [ ] T085 [US4] Verify test data still exists (GET /api/stocks)

**Developer Workflow**:
- [ ] T086 [US4] Make a code change in src/
- [ ] T087 [US4] Rebuild and restart: `docker-compose up --build`
- [ ] T088 [US4] Verify new code is running (check logs or behavior)
- [ ] T089 [US4] Stop all services: `docker-compose down`

**Checkpoint**: Local development environment matches production behavior; developers can test with one command.

---

## Phase 6: User Story 5 - Deploy to Cloud and Scale (Priority: P3)

**Goal**: Validate that the image can be deployed to cloud environments and scaled horizontally.

**Independent Test**: Push image to a registry, deploy to cloud (or simulate with multiple containers), verify external reachability.

**Acceptance Criteria**:
- Image can be pushed to container registry
- Same image runs in cloud environment
- Multiple instances can run behind load balancer (stateless design validated)

### Implementation for User Story 5

**Registry Push**:
- [ ] T100 [US5] Tag image for registry: `docker tag stock-trading-api:1.0.0 <registry>/stock-trading-api:1.0.0`
- [ ] T101 [US5] Push image to registry (Docker Hub, ECR, GCR, or similar)
- [ ] T102 [US5] Verify image is accessible in registry
- [ ] T103 [US5] Pull image from registry on different machine (or clean docker cache and re-pull)

**Cloud Deployment Documentation**:
- [ ] T104 [P] [US5] Document Kubernetes deployment example in quickstart.md (already exists)
- [ ] T105 [P] [US5] Document AWS ECS deployment example in quickstart.md (already exists)
- [ ] T106 [P] [US5] Document environment-specific configuration for cloud (secrets management)

**Horizontal Scaling Validation**:
- [ ] T107 [US5] Run multiple container instances locally: `docker run -d -p 3001:3000 ...` (instance 1)
- [ ] T108 [US5] Run second instance: `docker run -d -p 3002:3000 ...` (instance 2)
- [ ] T109 [US5] Verify both instances respond to health checks independently
- [ ] T110 [US5] Verify instances don't share state (stateless design confirmed)

**Cloud Configuration Verification**:
- [ ] T111 [US5] Document external MongoDB connection string format for cloud
- [ ] T112 [US5] Document secrets management strategy (AWS Secrets Manager, Kubernetes Secrets, etc.)
- [ ] T113 [US5] Document load balancer health check configuration (/health endpoint)
- [ ] T114 [US5] Document autoscaling configuration (HPA for Kubernetes, ECS Service autoscaling)

**Checkpoint**: Image is cloud-ready, can be deployed to any container runtime, and supports horizontal scaling.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, security scanning, documentation, and production readiness verification

**Security Scanning**:
- [ ] T120 [P] Scan image with Trivy: `trivy image stock-trading-api:1.0.0`
- [ ] T121 [P] Verify no HIGH or CRITICAL vulnerabilities in scan results
- [ ] T122 [P] Run npm audit in builder stage before image creation
- [ ] T123 [P] Document security scanning in CI/CD pipeline (quickstart.md)

**Quality Assurance**:
- [ ] T124 [P] Run hadolint on Dockerfile: `hadolint Dockerfile`
- [ ] T125 [P] Verify hadolint exits with 0 (no errors per .hadolint.yaml config)
- [ ] T126 [P] Run tests inside container: `docker run --rm stock-trading-api:1.0.0 npm test`
- [ ] T127 [P] Verify test coverage ≥80% inside container

**Documentation**:
- [ ] T128 [P] Update README.md with Docker quick start section
- [ ] T129 [P] Add link to specs/002-docker-deploy/quickstart.md in README.md
- [ ] T130 [P] Document troubleshooting common Docker issues in quickstart.md (already exists)
- [ ] T131 [P] Document production deployment checklist in quickstart.md (already exists)

**Production Readiness Checklist**:
- [ ] T132 Verify image uses explicit version tag (not latest)
- [ ] T133 Verify container runs as non-root user: `docker exec <container> whoami` → node
- [ ] T134 Verify graceful shutdown works (SIGTERM handling)
- [ ] T135 Verify health and metrics endpoints respond in container
- [ ] T136 Verify logs go to stdout (visible via docker logs)
- [ ] T137 Verify memory limits are configured (docker-compose.yml and Dockerfile CMD)

**CI/CD Integration** (Optional but Recommended):
- [ ] T138 [P] Create .github/workflows/docker-build.yml for CI/CD pipeline
- [ ] T139 [P] Add steps: checkout, build image, run hadolint, run trivy scan
- [ ] T140 [P] Add step: push to registry on main branch merge
- [ ] T141 [P] Add step: run tests inside built container before push

**Final Validation**:
- [ ] T142 Clean Docker environment: `docker system prune -a`
- [ ] T143 Build from scratch: `docker build -t stock-trading-api:final .`
- [ ] T144 Run final production checklist from quickstart.md
- [ ] T145 Verify all user stories (US1-US5) pass their independent tests
- [ ] T146 Merge feature branch to main with pull request

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **US1 Build Image (Phase 2)**: Depends on Setup completion - BLOCKS all other user stories
- **US2 Run Command (Phase 3)**: Depends on US1 (need built image to run)
- **US3 Configure (Phase 4)**: Depends on US2 (validates configuration options)
- **US4 Local Testing (Phase 5)**: Depends on US1 (docker-compose uses Dockerfile)
- **US5 Cloud Deploy (Phase 6)**: Depends on US1-US4 (validates cloud readiness)
- **Polish (Phase 7)**: Depends on all user stories being validated

### User Story Dependencies

```
Setup (Phase 1)
    ↓
US1: Build Image (Phase 2) ← MVP Checkpoint
    ↓
    ├─→ US2: Run Command (Phase 3)
    │       ↓
    │   US3: Configure (Phase 4)
    │
    └─→ US4: Local Testing (Phase 5)
            ↓
        US5: Cloud Deploy (Phase 6)
            ↓
        Polish (Phase 7)
```

### Within Each User Story

- Tasks are sequential within each phase (validation steps build on each other)
- Tasks marked [P] can run in parallel (different validation paths)
- Each phase must complete before moving to next phase

### Parallel Opportunities

- **Phase 1 (Setup)**: Tasks T002, T003, T004 can run in parallel (different files)
- **Phase 2 (US1)**: Tasks T010-T014 can run in parallel (Dockerfile inspection)
- **Phase 7 (Polish)**: Tasks T120-T127 can run in parallel (independent quality checks)
- **Phase 7 (Polish)**: Tasks T128-T131 can run in parallel (documentation updates)
- **Phase 7 (Polish)**: Tasks T138-T141 can run in parallel (CI/CD workflow creation)

---

## Parallel Example: User Story 1 (Build Image)

```bash
# Launch Dockerfile validation tasks together:
Task T010: "Validate Dockerfile passes hadolint"
Task T011: "Verify multi-stage build"
Task T012: "Verify node:20-alpine base"
Task T013: "Verify non-root user"
Task T014: "Verify HEALTHCHECK instruction"

# These all inspect the same Dockerfile independently
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (copy Docker files to root)
2. Complete Phase 2: User Story 1 (build image successfully)
3. **STOP and VALIDATE**: Verify image builds and is properly configured
4. MVP Complete: Distributable container image exists

### Incremental Delivery

1. Setup → Docker files in place
2. US1 → Image builds successfully (MVP!)
3. US2 → Image runs with single command
4. US3 → Configuration validation complete
5. US4 → Local development workflow validated
6. US5 → Cloud deployment ready
7. Polish → Production-ready with quality gates

### Validation Strategy

Each user story has an "Independent Test" that validates the story works on its own:
- **US1**: Build succeeds, image is tagged
- **US2**: Container runs and responds to health checks
- **US3**: Same image works with different configurations
- **US4**: docker-compose up works for local development
- **US5**: Image can be pushed to registry and deployed to cloud

---

## Notes

- **No source code changes**: This feature only adds Docker infrastructure files
- **Existing codebase is complete**: Application code, tests, and architecture are already implemented
- **Docker files already designed**: All Docker artifacts exist in `specs/002-docker-deploy/contracts/`
- **Testing approach**: Manual validation via docker commands (no automated tests for infrastructure)
- **Constitution compliance**: Existing code passes all requirements; Docker implementation follows constitution Docker section (VII)
- **Stateless design**: Application already uses external MongoDB, supports horizontal scaling
- [P] tasks = different validation paths, no dependencies
- [Story] label maps task to specific user story for traceability
- Commit after each phase completion
- Stop at any checkpoint to validate independently
