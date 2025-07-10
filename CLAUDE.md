# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Budget Management System (Gestor de Presupuesto)** built with a Go backend and Next.js frontend. The application allows users to track income, expenses, budgets, investments, and financial accounts with comprehensive analytics and reporting.

## Architecture

### Backend (Go)

- **Framework**: Gin HTTP router
- **Architecture**: Clean Architecture with domain-driven design
- **Database**: PostgreSQL (production), SQLite (testing)
- **Authentication**: JWT-based
- **Observability**: OpenTelemetry for tracing, metrics, and logging

### Frontend (Next.js)

- **Framework**: Next.js 14 with App Router
- **UI Components**: Shadcn/UI + Radix UI primitives
- **Styling**: Tailwind CSS with dark mode support
- **Charts**: Nivo charts for data visualization
- **State Management**: Zustand for global state
- **Authentication**: NextAuth.js

## Development Commands

### Backend (Go)

```bash
# Navigate to backend directory
cd BackEnd/

# Development with hot reload
make dev

# Start development environment (database + app)
make dev-start

# Run tests
make test
make test-coverage

# Run linting and formatting
make lint
make fmt

# Build for production
make build-prod

# Run database migrations
make migrate

# E2E testing
make e2e

# Security analysis
make security

# Check project health
make health
```

### Frontend (Next.js)

```bash
# Navigate to frontend directory
cd FrontendNextjs/gestor/

# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Type checking
npm run type-check

# Code quality check (all checks)
npm run code-quality
```

## Code Architecture

### Backend Structure

```
BackEnd/
├── internal/
│   ├── domain/          # Business entities (User, Account, Transaction, etc.)
│   ├── services/        # Use cases and business logic
│   └── platform/
│       ├── dto/         # Data transfer objects
│       ├── server/      # HTTP handlers and middleware
│       ├── storage/     # Repository implementations
│       └── utils/       # Shared utilities
├── cmd/api/            # Application entrypoint
└── httpRequest/        # HTTP test files
```

### Frontend Structure

```
FrontendNextjs/gestor/
├── app/                # Next.js App Router pages
├── components/         # Reusable UI components
│   ├── accounts/       # Account-specific components
│   ├── auth/          # Authentication components
│   ├── transactions/  # Transaction components
│   └── ui/            # Base UI components (Shadcn)
├── hooks/             # Custom React hooks
├── lib/               # Utility libraries
├── repository/        # API client implementations
├── types/             # TypeScript type definitions
└── contexts/          # React contexts
```

## Core Entities

- **User**: Authentication and profile management
- **Account**: Bank accounts with balance tracking
- **Transaction**: Income/expense records with categorization
- **Category**: Customizable transaction categories
- **Budget**: Spending limits per category
- **Investment**: Portfolio tracking for stocks/crypto

## Development Guidelines

### Backend (Go)

- Follow Clean Architecture principles
- Use interfaces for dependency injection
- Implement comprehensive error handling with context
- Write table-driven tests with parallel execution
- Use OpenTelemetry for observability
- Apply security best practices (input validation, JWT, CORS)

### Frontend (Next.js)

- Use function declarations for components
- Follow TypeScript strict mode
- Use Server Components by default, 'use client' only when necessary
- Implement proper error boundaries
- Use Zod for form validation
- Follow accessibility guidelines (a11y)

## Testing Strategy

### Backend

- **Unit Tests**: Mock external dependencies, focus on business logic
- **Integration Tests**: Use SQLite in-memory for repository testing
- **E2E Tests**: Full application testing with Docker containers
- **Benchmarks**: Performance testing for critical paths

### Frontend

- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: User workflow testing
- **Type Checking**: TypeScript strict mode

## Environment Setup

### Backend Environment Variables

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_store
DB_USER=osmait
DB_PASSWORD=admin123
SERVER_HOST=localhost
SERVER_PORT=8080
JWT_SECRET=your-secret-key
ENV=development
```

### Docker Development

```bash
# Start full development environment
make dev-full

# Backend + Database only
make dev-start

# Stop environment
make dev-stop
```

## API Endpoints

- **Auth**: `/login`, `/user`, `/profile`
- **Accounts**: `/account`
- **Transactions**: `/transaction`
- **Categories**: `/category`
- **Budgets**: `/budget`
- **Investments**: `/invesment`

## Important Notes

### Code Style

- **Backend**: Use gofmt, goimports, golangci-lint
- **Frontend**: Use tabs for indentation, single quotes, no semicolons
- Follow naming conventions in each codebase's .cursorrules

### Database

- PostgreSQL for production
- SQLite for testing (faster test execution)
- Use migrations for schema changes
- Repository pattern for data access

### Security

- JWT authentication
- Input validation and sanitization
- CORS configuration
- Rate limiting
- Secret management via environment variables

### Performance

- Database connection pooling
- Frontend code splitting
- Image optimization with Next.js Image component
- Caching strategies for API responses

## Observability

The backend implements comprehensive observability with OpenTelemetry:

- **Tracing**: Request tracing across all service boundaries
- **Metrics**: Application performance metrics
- **Logging**: Structured logging with trace correlation

## Before Making Changes

1. Run the appropriate test suites
2. Check code formatting and linting
3. Ensure TypeScript compilation passes
4. Run security analysis for backend changes
5. Test locally before committing

This project emphasizes clean code, comprehensive testing, and robust observability to ensure maintainability and reliability.

