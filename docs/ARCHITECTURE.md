# Architecture: Vertical Slicing

## Overview

This codebase follows **Vertical Slicing** (also known as Feature-Based Architecture) combined with **Hexagonal Architecture** principles. Code is organized by business capabilities (features) rather than technical layers.

## Structure

```
src/
├── features/                    # Vertical slices by business capability
│   ├── stocks/                  # Stock listing feature
│   │   ├── domain/             # Stock entities, domain logic
│   │   │   └── entities/       # stock.ts
│   │   ├── application/         # Use cases
│   │   │   └── use-cases/      # list-stocks.ts
│   │   ├── infrastructure/      # Adapters & HTTP layer
│   │   │   ├── adapters/       # stock-vendor.adapter.ts
│   │   │   ├── controllers/     # stocks.controller.ts
│   │   │   └── routes/         # stocks.routes.ts
│   │   └── ports/               # Interfaces
│   │       └── services/       # stock-vendor.port.ts
│   │
│   ├── portfolio/               # Portfolio management feature
│   │   ├── domain/
│   │   │   └── entities/       # portfolio.ts
│   │   ├── application/
│   │   │   └── use-cases/      # get-portfolio.ts
│   │   ├── infrastructure/
│   │   │   ├── repositories/   # portfolio.repository.ts, portfolio.model.ts
│   │   │   ├── controllers/    # portfolio.controller.ts
│   │   │   └── routes/         # portfolio.routes.ts
│   │   └── ports/
│   │       └── repositories/   # portfolio-repository.port.ts
│   │
│   ├── purchases/               # Purchase execution feature
│   │   ├── application/
│   │   │   └── use-cases/      # execute-purchase.ts
│   │   └── infrastructure/
│   │       ├── controllers/    # purchases.controller.ts
│   │       └── routes/         # purchases.routes.ts
│   │
│   ├── sales/                   # Sales execution feature
│   │   ├── application/
│   │   │   └── use-cases/      # execute-sell.ts
│   │   └── infrastructure/
│   │       ├── controllers/    # sales.controller.ts
│   │       └── routes/         # sales.routes.ts
│   │
│   └── shared/                  # Shared components across features
│       ├── domain/
│       │   ├── entities/       # transaction.ts
│       │   ├── errors/         # AppError, ValidationError, etc.
│       │   └── services/       # price-tolerance.ts
│       ├── infrastructure/
│       │   ├── config/         # Configuration, logger, container
│       │   ├── persistence/   # mongo-connection.ts
│       │   ├── repositories/   # transaction.repository.ts, transaction.model.ts
│       │   └── http/           # app.ts, middlewares, routes (health, metrics)
│       └── ports/
│           └── repositories/   # transaction-repository.port.ts
│
└── index.ts                     # Application entry point
```

## Principles

### 1. Vertical Slicing

- **Each feature is self-contained**: Contains its own domain, application, infrastructure, and ports
- **Features communicate through ports**: No direct dependencies between features
- **Shared code lives in `shared/`**: Common entities (Transaction), errors, services, and infrastructure

### 2. Hexagonal Architecture (within each feature)

- **Domain Layer**: Pure business logic, no external dependencies
- **Application Layer**: Use cases that orchestrate domain logic
- **Infrastructure Layer**: Adapters for external concerns (DB, HTTP, external APIs)
- **Ports**: Interfaces defining contracts between layers

### 3. Feature Independence

- Features can be developed and tested independently
- Changes to one feature don't affect others
- Easy to add new features without modifying existing code

## Benefits

1. **Better Organization**: Related code is grouped together by business capability
2. **Easier Navigation**: Find all code for a feature in one place
3. **Parallel Development**: Teams can work on different features simultaneously
4. **Clear Boundaries**: Features communicate through well-defined interfaces
5. **Scalability**: Easy to add new features without affecting existing ones

## Migration Notes

This structure was migrated from a horizontal layer-based organization:
- **Before**: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/ports/`
- **After**: `src/features/{feature-name}/{domain|application|infrastructure|ports}/`

All imports have been updated to reflect the new structure. See `.specify/memory/constitution.md` for architectural principles.
