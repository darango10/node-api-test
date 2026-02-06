<!--
  SYNC IMPACT REPORT
  ==================
  Version Change: [TEMPLATE] → 1.0.0 (Initial constitution)
  
  Modified/Added Principles:
  - NEW: I. Hexagonal Architecture (Ports & Adapters)
  - NEW: II. SOLID Principles
  - NEW: III. Clean, Modular Code
  - NEW: IV. Comprehensive Testing Strategy
  - NEW: V. Robust Error Handling
  - NEW: VI. Production Readiness & Observability
  - NEW: VII. Security-First Development
  
  Added Sections:
  - Node.js Specific Practices (referencing goldbergyoni/nodebestpractices)
  - Development Workflow & Quality Gates
  
  Templates Requiring Updates:
  ✅ plan-template.md - Constitution Check gates updated to reflect new principles
  ✅ spec-template.md - Requirements sections align with architecture principles
  ✅ tasks-template.md - Task categorization reflects testing discipline and architecture layers
  
  Follow-up TODOs:
  - None - All placeholders filled with concrete values
  
  Rationale for version 1.0.0:
  - This is the initial ratification of the project constitution
  - Establishes foundational governance for the node-api project
  - Incorporates industry best practices from goldbergyoni/nodebestpractices
-->

# Node API Constitution

## Core Principles

### I. Hexagonal Architecture (Ports & Adapters)

**NON-NEGOTIABLE**: All code MUST follow hexagonal architecture to ensure separation of concerns and testability.

- **Domain Layer**: Core business logic with ZERO external dependencies (no frameworks, DBs, HTTP)
- **Application Layer**: Use cases/services that orchestrate domain logic
- **Infrastructure Layer**: Adapters for external concerns (DB, HTTP, message queues, file systems)
- **Ports**: Interfaces defining contracts between layers (domain defines ports, infrastructure implements)

**Rationale**: Hexagonal architecture enables testing business logic in isolation, swapping implementations (e.g., PostgreSQL → MongoDB), and evolving the system without coupling to frameworks or external tools.

**Structure Enforcement**:
```
src/
├── domain/           # Business logic, entities, domain services (NO external deps)
├── application/      # Use cases, application services (depends on domain only)
├── infrastructure/   # Adapters: DB, HTTP, external APIs, file system
│   ├── http/        # Express routes, controllers
│   ├── persistence/ # Database implementations
│   └── external/    # Third-party integrations
└── ports/           # Interfaces/contracts (domain → infrastructure)
```

### II. SOLID Principles

**MANDATORY**: All classes, functions, and modules MUST adhere to SOLID principles.

- **Single Responsibility**: Each module/class/function has ONE reason to change
- **Open/Closed**: Open for extension, closed for modification (use composition, dependency injection)
- **Liskov Substitution**: Subtypes must be substitutable for their base types without breaking functionality
- **Interface Segregation**: Clients should not depend on interfaces they don't use (prefer small, focused interfaces)
- **Dependency Inversion**: Depend on abstractions (ports/interfaces), not concrete implementations

**Enforcement**:
- Code reviews MUST check for SOLID violations
- Refactor when a class/function has multiple responsibilities
- Use dependency injection containers (e.g., `tsyringe`, `awilix`) for clean DI

**Rationale**: SOLID principles reduce coupling, increase cohesion, and make the codebase maintainable as it scales.

### III. Clean, Modular Code

**NON-NEGOTIABLE**: Code MUST be clean, readable, and modular.

**Modularity Requirements**:
- **Structure by business components**, not technical layers (each feature folder contains its own layers)
- Each module has a clear, single purpose
- Modules are independently testable
- Avoid circular dependencies (enforce with tools like `madge`)
- Export public APIs explicitly via `index.ts` (hide internal implementation details)

**Code Quality Standards**:
- Prefer `const` over `let`; eliminate `var` entirely
- Use async/await over callbacks (escape callback hell)
- Use arrow functions for lexical `this` binding
- Name functions descriptively (no anonymous functions in production code)
- Follow ESLint rules with Node.js security plugins (`eslint-plugin-security`, `eslint-plugin-node`)
- Maximum function length: 20 lines (exception requires justification)
- Maximum file length: 200 lines (exception requires justification)

**Naming Conventions**:
- Variables/functions: `lowerCamelCase`
- Classes/Interfaces: `UpperCamelCase`
- Constants/Environment Variables: `UPPER_SNAKE_CASE`
- Private members: prefix with `_` (e.g., `_privateMethod`)

**Rationale**: Clean code reduces cognitive load, accelerates development, and minimizes bugs. Modularity enables parallel development and independent testing.

### IV. Comprehensive Testing Strategy

**NON-NEGOTIABLE**: TDD (Test-Driven Development) MUST be followed for all new features.

**Testing Pyramid** (from goldbergyoni/nodebestpractices):
1. **Unit Tests**: Test domain logic in isolation (70% of tests)
   - Fast, deterministic, no external dependencies
   - Use test doubles (mocks, stubs, spies) for ports
   
2. **Integration Tests**: Test application services with real adapters (20% of tests)
   - Test database operations, API integrations
   - Use test databases (Docker containers, in-memory DBs)
   - Mock external HTTP services (use `nock` for HTTP mocking)
   
3. **Contract Tests**: Verify API contracts (5% of tests)
   - Test HTTP endpoints against expected schemas
   - Use tools like `Supertest` for API testing
   
4. **End-to-End Tests**: Critical user journeys only (5% of tests)
   - Expensive, slow, fragile - use sparingly
   - Test happy paths and critical error scenarios

**Testing Discipline**:
- **Red-Green-Refactor**: Write failing test → Make it pass → Refactor
- **AAA Pattern**: Arrange-Act-Assert structure in all tests
- **Test Name Format**: `should [expected behavior] when [condition]`
- **Coverage Threshold**: Minimum 80% code coverage (enforce in CI)
- **Test Isolation**: Each test sets up its own data (no shared fixtures)
- **Tag Tests**: Use tags (`#unit`, `#integration`, `#e2e`) for selective execution

**Test Organization**:
```
tests/
├── unit/           # Domain & application layer tests
├── integration/    # Infrastructure adapter tests
├── contract/       # API contract tests
└── e2e/           # End-to-end user journey tests
```

**Rationale**: TDD catches bugs early, improves design (forces decoupling), and provides living documentation. The testing pyramid balances speed, cost, and confidence.

### V. Robust Error Handling

**NON-NEGOTIABLE**: All errors MUST be handled explicitly and centrally.

**Error Handling Strategy** (from goldbergyoni/nodebestpractices):
- **Use async/await**: Never use callbacks (avoid callback hell and unhandled rejections)
- **Extend Built-in Error**: Create custom error classes (e.g., `DomainError`, `ValidationError`, `NotFoundError`)
- **Distinguish Error Types**:
  - **Operational Errors**: Expected failures (invalid input, DB connection lost) → Log, return 4xx/5xx, continue
  - **Programmer Errors**: Bugs (null reference, syntax errors) → Log, crash process, let orchestrator restart
- **Centralized Error Handler**: All errors flow to a single handler (not scattered in middleware)
- **Never swallow errors**: Always log or propagate (no empty `catch` blocks)
- **Always `await` promises**: Avoid returning promises without `await` (loses stack trace context)
- **Handle `unhandledRejection` and `uncaughtException`**: Subscribe to process events, log, and gracefully shutdown

**Error Object Structure**:
```typescript
class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public isOperational: boolean = true,
    public errorCode?: string
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**Centralized Error Handler** (Express example):
```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError && err.isOperational) {
    // Operational error - safe to return to client
    return res.status(err.statusCode).json({ error: err.message, code: err.errorCode });
  }
  // Programmer error - log and hide details from client
  logger.error('Catastrophic error', { err, req });
  res.status(500).json({ error: 'Internal server error' });
  process.exit(1); // Let orchestrator (Docker, K8s) restart
});
```

**Rationale**: Robust error handling prevents silent failures, improves observability, and ensures the system fails gracefully or recovers appropriately.

### VI. Production Readiness & Observability

**MANDATORY**: All code MUST be production-ready with comprehensive observability.

**Logging** (from goldbergyoni/nodebestpractices):
- Use structured logging library (e.g., `pino`, `winston`)
- Log to `stdout` (let infrastructure route logs, not the app)
- Include context: transaction ID, user ID, correlation ID (use `AsyncLocalStorage` for request context)
- Log levels: `error`, `warn`, `info`, `debug`, `trace` (configure per environment)
- Log format: JSON for production (machine-readable), pretty for development
- **NEVER log secrets** (passwords, tokens, API keys)

**Monitoring & Metrics**:
- Expose `/health` endpoint (liveness + readiness checks)
- Expose `/metrics` endpoint (Prometheus format)
- Monitor key metrics: request rate, error rate, latency (p50, p95, p99), memory usage, CPU usage
- Use APM tools (e.g., New Relic, Datadog, Elastic APM) for distributed tracing

**Configuration**:
- Environment-aware config (dev, staging, production)
- Use environment variables for secrets (never commit secrets)
- Validate configuration at startup (fail fast if missing required config)
- Use hierarchical config (e.g., `convict`, `env-var`, `zod`)

**Process Management**:
- Set `NODE_ENV=production` in production
- Utilize all CPU cores (use cluster module or let orchestrator handle replication)
- Handle `SIGTERM` and `SIGINT` for graceful shutdown:
  - Stop accepting new requests
  - Wait for existing requests to complete (with timeout)
  - Close DB connections, release resources
  - Exit with code 0
- Restart process on catastrophic errors (let orchestrator handle restarts)

**Performance**:
- Lock dependencies with `package-lock.json` or `yarn.lock`
- Use `npm ci` in CI/production (faster, deterministic installs)
- Delegate CPU-intensive tasks (gzip, SSL) to reverse proxy (nginx, HAProxy)
- Avoid blocking the event loop (offload heavy computation to worker threads or separate services)

**Rationale**: Production readiness ensures the system is observable, resilient, and performant under load. Observability enables rapid debugging and incident response.

### VII. Security-First Development

**NON-NEGOTIABLE**: Security MUST be considered at every layer.

**Security Practices** (from goldbergyoni/nodebestpractices):
- **Lint for security**: Use `eslint-plugin-security` to catch vulnerabilities (eval, child_process misuse, etc.)
- **Dependency scanning**: Run `npm audit` or `snyk` in CI (fail build on high/critical vulnerabilities)
- **Rate limiting**: Protect all endpoints (use `express-rate-limit` or reverse proxy)
- **Input validation**: Validate all inputs with schemas (e.g., `joi`, `zod`, `ajv`)
- **Query injection prevention**: Use ORM/ODM with parameterized queries (e.g., `Sequelize`, `TypeORM`, `Prisma`)
- **Password hashing**: Use `bcrypt` or `scrypt` (never plain text or weak hashes like MD5)
- **Secure headers**: Use `helmet` middleware to set secure HTTP headers
- **JWT best practices**: Support blocklisting (use Redis for token revocation), short expiration times
- **Secrets management**: Never commit secrets; use environment variables or secret managers (AWS Secrets Manager, Vault)
- **Avoid `eval()`, `new Function()`, dynamic requires**: These open code injection vectors
- **Run as non-root user**: Use `USER node` in Dockerfiles
- **Limit payload size**: Prevent DoS attacks by limiting request body size (e.g., `body-parser` limit)
- **Escape output**: Prevent XSS by escaping HTML, JS, CSS in responses
- **CORS**: Configure CORS explicitly (don't use `*` in production)
- **Import built-ins with `node:` protocol**: e.g., `import http from 'node:http'` (prevents typosquatting)

**Rationale**: Security breaches are costly and damage trust. Defense-in-depth (multiple security layers) minimizes risk.

## Node.js Specific Practices

**Reference**: [goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices)

This project MUST follow the best practices outlined in the Node.js Best Practices repository. Key areas:

1. **Project Architecture**:
   - Structure by business components (not technical layers)
   - Layer components (entry-points, domain, data-access)
   - Wrap common utilities as packages

2. **Error Handling**:
   - Use async/await for all async code
   - Extend built-in Error object
   - Distinguish operational vs. programmer errors
   - Handle errors centrally
   - Document API errors (OpenAPI/Swagger)
   - Catch `unhandledRejection` events

3. **Code Style**:
   - Use ESLint with Node.js plugins (`eslint-plugin-node`, `eslint-plugin-security`)
   - Follow naming conventions (camelCase, PascalCase, UPPER_SNAKE_CASE)
   - Prefer `const`, avoid `var`
   - Require modules first (not inside functions)
   - Use explicit entry points (`index.ts` per module)
   - Use `===` over `==`
   - Use async/await, avoid callbacks

4. **Testing**:
   - Write API (component) tests at minimum
   - Structure tests with AAA pattern (Arrange-Act-Assert)
   - Avoid global test fixtures (add data per-test)
   - Tag tests for selective execution
   - Check coverage (minimum 80%)
   - Mock external HTTP services

5. **Going to Production**:
   - Enable monitoring (uptime, metrics, APM)
   - Use smart logging (structured, JSON, with context)
   - Delegate infrastructure tasks to reverse proxy
   - Lock dependencies (`package-lock.json`)
   - Guard process uptime (orchestrator handles restarts)
   - Utilize all CPU cores (cluster or orchestrator replication)
   - Set `NODE_ENV=production`
   - Log to `stdout`, avoid log destination in app
   - Use `npm ci` for installs

6. **Security**:
   - Embrace linter security rules
   - Limit concurrent requests (rate limiting)
   - Extract secrets from config files
   - Prevent query injection (use ORM/ODM)
   - Adjust HTTP headers for security (`helmet`)
   - Scan for vulnerable dependencies (`npm audit`, `snyk`)
   - Hash passwords with `bcrypt`/`scrypt`
   - Validate incoming JSON schemas
   - Prevent brute-force attacks
   - Run as non-root user
   - Avoid `eval()`, unsafe RegEx, dynamic requires

7. **Docker**:
   - Use multi-stage builds
   - Bootstrap with `node` command (not `npm start`)
   - Use `.dockerignore` to prevent leaking secrets
   - Clean dependencies before production
   - Shutdown gracefully (handle `SIGTERM`)
   - Set memory limits (Docker + v8)
   - Use explicit image tags (avoid `latest`)
   - Prefer smaller base images (`node:alpine`)
   - Scan images for vulnerabilities
   - Lint Dockerfile (use `hadolint`)

## Development Workflow & Quality Gates

**Branching Strategy**:
- `main` branch is production-ready (protected, requires PR reviews)
- Feature branches: `[###-feature-name]` (e.g., `001-user-authentication`)
- No direct commits to `main`

**Pull Request Requirements**:
- All tests pass (unit, integration, contract)
- Code coverage ≥ 80%
- No linting errors
- No security vulnerabilities (npm audit, snyk)
- Code review by at least 1 team member
- Constitution compliance verified

**Code Review Checklist**:
- [ ] Hexagonal architecture followed (domain, application, infrastructure layers separated)
- [ ] SOLID principles adhered to
- [ ] Clean, modular code (no long functions, clear naming)
- [ ] Tests follow TDD (Red-Green-Refactor)
- [ ] Error handling robust (operational vs. programmer errors distinguished)
- [ ] Logging structured with context (transaction ID, user ID)
- [ ] Security best practices applied (input validation, secrets excluded, etc.)
- [ ] No new dependencies without justification
- [ ] Documentation updated (if applicable)

**Continuous Integration**:
- Run linting (`npm run lint`)
- Run security checks (`npm audit`, `snyk test`)
- Run tests (`npm test`)
- Check coverage (`npm run coverage`)
- Build Docker image (if applicable)
- Scan Docker image for vulnerabilities

**Deployment**:
- Automated, zero-downtime deployments
- Use rolling updates or blue-green deployments
- Run smoke tests post-deployment
- Monitor error rates and latency spikes
- Rollback plan ready

## Governance

**Constitution Authority**:
- This constitution supersedes all other coding standards, style guides, and practices
- Any conflict between this constitution and other documents is resolved in favor of this constitution

**Amendment Process**:
1. Propose amendment with rationale (via PR or design document)
2. Team review and discussion
3. Approval by majority vote (or project lead decision)
4. Update constitution version per semantic versioning:
   - **MAJOR**: Backward-incompatible changes (principle removed, redefined)
   - **MINOR**: New principle added, material expansion
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements
5. Document amendment in Sync Impact Report
6. Update dependent templates (plan-template.md, spec-template.md, tasks-template.md)
7. Communicate changes to team

**Compliance Review**:
- All PRs/code reviews MUST verify compliance with this constitution
- Violations MUST be justified and documented (with approved exception)
- Complexity MUST be justified (document why simpler alternatives rejected)

**Enforcement**:
- Automated checks in CI (linting, security, coverage)
- Manual checks in code reviews (architecture, SOLID, testing discipline)
- Periodic audits (quarterly) to ensure ongoing compliance

**Living Document**:
- This constitution is a living document, expected to evolve
- Review constitution every 6 months (or after major project milestones)
- Capture lessons learned and incorporate into principles

**Version**: 1.0.0 | **Ratified**: 2026-02-06 | **Last Amended**: 2026-02-06
