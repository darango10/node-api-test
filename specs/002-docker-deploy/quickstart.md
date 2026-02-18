# Docker Deployment Quickstart

**Feature**: 002-docker-deploy  
**Date**: 2025-02-08

## Overview

This guide provides step-by-step instructions for building, running, and deploying the Stock Trading API using Docker. Three deployment modes are supported:

1. **Local Development** - Docker Compose with MongoDB
2. **Production Build** - Standalone Docker container
3. **Cloud Deployment** - Container orchestrators (Kubernetes, ECS, etc.)

---

## Prerequisites

### Required Tools

- **Docker Engine** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ (included with Docker Desktop)
- **Git** (to clone the repository)

### Optional Tools

- **hadolint** - Dockerfile linting ([Install hadolint](https://github.com/hadolint/hadolint#install))
- **trivy** - Security scanning ([Install trivy](https://aquasecurity.github.io/trivy/latest/getting-started/installation/))

### Verify Installation

```bash
docker --version
# Docker version 24.0.0 or higher

docker-compose --version
# Docker Compose version 2.0.0 or higher
```

---

## Local Development Mode

### Quick Start (3 Steps)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd node-api
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env: set VENDOR_API_URL and VENDOR_API_KEY so the vendor API works.
   # Placeholder values cause 502 on /stocks and purchases. For local vendor on host use:
   #   VENDOR_API_URL=http://host.docker.internal:4000
   #   VENDOR_API_KEY=<your-vendor-api-key>
   ```

3. **Start services**:
   ```bash
   docker-compose up
   ```

   The API will be available at `http://localhost:3000`

### Verify It's Working

```bash
# Check health endpoint
curl http://localhost:3000/health

# Verify vendor API (requires valid VENDOR_API_URL and VENDOR_API_KEY in .env)
curl http://localhost:3000/stocks

# View API documentation
open http://localhost:3000/api-docs

# Check logs
docker-compose logs -f app
```

### Development Workflow

**Rebuild after code changes**:
```bash
docker-compose up --build
```

**Stop services**:
```bash
docker-compose down
```

**Reset database** (delete all data):
```bash
docker-compose down -v
```

**View MongoDB data** (optional):
```bash
# Uncomment mongo-express service in docker-compose.yml
docker-compose up mongo-express
# Open http://localhost:8081
```

---

## Production Build Mode

### Build the Image

```bash
# Enable BuildKit for better performance
export DOCKER_BUILDKIT=1

# Build with version tag
docker build -t stock-trading-api:1.0.0 .

# Or build with commit SHA
docker build -t stock-trading-api:$(git rev-parse --short HEAD) .
```

### Run the Container

**Prerequisites**: MongoDB must be running and accessible.

```bash
docker run -d \
  --name stock-trading-api \
  -p 3000:3000 \
  --env-file .env \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/stock-trading \
  stock-trading-api:1.0.0
```

**Note**: Use `host.docker.internal` on Docker Desktop (Mac/Windows) to access host MongoDB. On Linux, use `--network=host` or the host's IP address.

### Run with Memory Limits

```bash
docker run -d \
  --name stock-trading-api \
  -p 3000:3000 \
  --memory=512m \
  --memory-swap=512m \
  --env-file .env \
  stock-trading-api:1.0.0
```

### Check Container Health

```bash
# View container status
docker ps

# Check health status
docker inspect --format='{{.State.Health.Status}}' stock-trading-api

# View logs
docker logs -f stock-trading-api
```

### Stop and Remove

```bash
docker stop stock-trading-api
docker rm stock-trading-api
```

---

## Configuration

### Environment Variables

The application requires these environment variables (see `.env.example`):

**Required**:
- `NODE_ENV` - Environment: `development` | `production` | `test`
- `PORT` - HTTP port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `VENDOR_API_URL` - External stock vendor API URL
- `LOG_LEVEL` - Logging level: `fatal` | `error` | `warn` | `info` | `debug` | `trace`

**Optional**:
- `VENDOR_API_KEY` - External API authentication token
- `REPORT_RECIPIENTS` - Email list for daily reports
- `SMTP_*` - Email server configuration

### Configuration Methods

**1. Environment File** (recommended for local):
```bash
docker run --env-file .env stock-trading-api:1.0.0
```

**2. Environment Variables** (recommended for production):
```bash
docker run \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e MONGODB_URI=mongodb://mongo.example.com:27017/prod \
  -e VENDOR_API_URL=https://api.vendor.com \
  -e VENDOR_API_KEY=secret123 \
  -e LOG_LEVEL=info \
  stock-trading-api:1.0.0
```

**3. Docker Compose** (local development):
```yaml
# docker-compose.yml
services:
  app:
    environment:
      NODE_ENV: development
      PORT: 3000
    env_file: .env
```

---

## Cloud Deployment

### Push to Container Registry

**Docker Hub**:
```bash
# Tag image
docker tag stock-trading-api:1.0.0 username/stock-trading-api:1.0.0

# Login
docker login

# Push
docker push username/stock-trading-api:1.0.0
```

**AWS ECR**:
```bash
# Authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Tag
docker tag stock-trading-api:1.0.0 123456789.dkr.ecr.us-east-1.amazonaws.com/stock-trading-api:1.0.0

# Push
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/stock-trading-api:1.0.0
```

**Google Container Registry**:
```bash
# Authenticate
gcloud auth configure-docker

# Tag
docker tag stock-trading-api:1.0.0 gcr.io/project-id/stock-trading-api:1.0.0

# Push
docker push gcr.io/project-id/stock-trading-api:1.0.0
```

### Kubernetes Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stock-trading-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stock-trading-api
  template:
    metadata:
      labels:
        app: stock-trading-api
    spec:
      containers:
      - name: api
        image: stock-trading-api:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: uri
        - name: VENDOR_API_KEY
          valueFrom:
            secretKeyRef:
              name: vendor-secret
              key: api-key
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 40
          periodSeconds: 30
          timeoutSeconds: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 40
          periodSeconds: 10
          timeoutSeconds: 3
---
apiVersion: v1
kind: Service
metadata:
  name: stock-trading-api
spec:
  selector:
    app: stock-trading-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### AWS ECS Task Definition Example

```json
{
  "family": "stock-trading-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/stock-trading-api:1.0.0",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "LOG_LEVEL", "value": "info"}
      ],
      "secrets": [
        {
          "name": "MONGODB_URI",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:mongodb-uri"
        },
        {
          "name": "VENDOR_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:vendor-api-key"
        }
      ],
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "node -e \"require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))\""
        ],
        "interval": 30,
        "timeout": 3,
        "retries": 3,
        "startPeriod": 40
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/stock-trading-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
```

---

## Quality Assurance

### Lint Dockerfile

```bash
# Install hadolint
docker pull hadolint/hadolint

# Run linting
docker run --rm -i hadolint/hadolint < Dockerfile

# Or with local hadolint
hadolint Dockerfile
```

Expected output: No errors (warnings are acceptable per `.hadolint.yaml` config).

### Security Scan

```bash
# Install trivy
brew install aquasecurity/trivy/trivy  # macOS
# Or: https://aquasecurity.github.io/trivy/latest/getting-started/installation/

# Scan image for vulnerabilities
trivy image stock-trading-api:1.0.0

# Fail on HIGH/CRITICAL vulnerabilities
trivy image --severity HIGH,CRITICAL --exit-code 1 stock-trading-api:1.0.0
```

Expected output: No HIGH or CRITICAL vulnerabilities.

### Test Coverage

```bash
# Run tests in Docker (same environment as production)
docker run --rm stock-trading-api:1.0.0 npm test

# Check coverage
docker run --rm stock-trading-api:1.0.0 npm run coverage
```

Expected output: ≥80% coverage on all metrics (lines, branches, functions, statements).

---

## Troubleshooting

### Container Won't Start

**Check logs**:
```bash
docker logs stock-trading-api
```

**Common issues**:
1. **Missing environment variables**: Ensure `.env` file exists or variables are set
2. **MongoDB connection failed**: Verify `MONGODB_URI` is correct and MongoDB is accessible
3. **Port already in use**: Change port mapping: `-p 3001:3000`

### Container Unhealthy

**Check health status**:
```bash
docker inspect --format='{{json .State.Health}}' stock-trading-api | jq
```

**Common causes**:
1. **Database not ready**: Wait for MongoDB startup (check `depends_on` in docker-compose.yml)
2. **Slow startup**: Increase `start_period` in HEALTHCHECK (default: 40s)
3. **App crash**: Check logs for errors

### Build Fails

**Clear Docker cache**:
```bash
docker builder prune -a
docker build --no-cache -t stock-trading-api:1.0.0 .
```

**Common issues**:
1. **npm install fails**: Check network connectivity, verify `package-lock.json` integrity
2. **TypeScript compilation fails**: Check for syntax errors in source code
3. **Out of disk space**: Run `docker system prune -a`

### Can't Connect to MongoDB from Container

**Docker Compose**: MongoDB is automatically accessible at `mongodb://mongo:27017`

**Standalone container**:
- **Mac/Windows**: Use `host.docker.internal`: `mongodb://host.docker.internal:27017`
- **Linux**: Use host IP or `--network=host` flag

### Performance Issues

**Check resource usage**:
```bash
docker stats stock-trading-api
```

**Increase limits**:
```bash
docker run --memory=1g --cpus=2 stock-trading-api:1.0.0
```

---

## Production Checklist

Before deploying to production, verify:

- [ ] All tests pass (`npm test`)
- [ ] Test coverage ≥ 80% (`npm run coverage`)
- [ ] Dockerfile passes hadolint (`hadolint Dockerfile`)
- [ ] Image passes security scan (`trivy image stock-trading-api:1.0.0`)
- [ ] Health endpoint responds (`curl http://localhost:3000/health`)
- [ ] Metrics endpoint responds (`curl http://localhost:3000/metrics`)
- [ ] Graceful shutdown works (`docker stop` completes within 30s)
- [ ] Image uses explicit tag (not `latest`)
- [ ] Secrets not in image (verify with `docker history stock-trading-api:1.0.0`)
- [ ] Container runs as non-root user (`docker exec stock-trading-api whoami` → `node`)
- [ ] Memory limits configured
- [ ] Logs go to stdout (visible via `docker logs`)
- [ ] Environment-specific config via environment variables
- [ ] MongoDB connection uses external service (not Docker Compose mongo)

---

## Next Steps

1. **Set up CI/CD pipeline**: Automate build, test, scan, push
2. **Configure monitoring**: Integrate with Prometheus, Grafana, or APM tools
3. **Set up log aggregation**: Forward logs to ELK, Datadog, or CloudWatch
4. **Implement autoscaling**: Configure horizontal pod autoscaler in Kubernetes
5. **Set up alerts**: Monitor error rates, response times, resource usage

---

## References

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Docker Documentation](https://docs.docker.com/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Project Constitution](../../.specify/memory/constitution.md)
