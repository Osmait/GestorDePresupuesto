
.PHONY: frontend backend dev services help backend-check frontend-check full-check test-e2e lint-backend test-backend build-backend lint-frontend test-frontend build-frontend

# Default target
all: help

# Frontend commands
frontend:
	@echo "Starting Frontend..."
	cd FrontendNextjs/gestor && npm run dev

# Backend commands
backend:
	@echo "Starting Backend..."
	cd BackEnd && make dev

# Start required services (Database)
services:
	@echo "Starting Backend Services (Database)..."
	cd BackEnd && make dev-start

# Help command
help:
	@echo "Available commands:"
	@echo "  make frontend       - Start the Next.js Frontend"
	@echo "  make backend        - Start the Go Backend (with Air)"
	@echo "  make services       - Start Backend Database services (Docker)"
	@echo "  make backend-check  - Run Lint, Test and Build for Backend"
	@echo "  make frontend-check - Run Lint, Test and Build for Frontend"
	@echo "  make test-e2e       - Run Playwright E2E tests"
	@echo "  make full-check     - Run ALL checks (Backend, Frontend, E2E)"

# Aggregate Commands
backend-check: lint-backend test-backend build-backend
	@echo "Backend check completed successfully!"

frontend-check: lint-frontend test-frontend build-frontend
	@echo "Frontend check completed successfully!"

full-check: backend-check frontend-check test-e2e
	@echo "All project checks passed!"

# E2E Tests
test-e2e:
	@echo "Running E2E Tests..."
	cd e2e-test && npx playwright test

# Backend Detail Commands
lint-backend:
	@echo "Linting Backend..."
	cd BackEnd && make lint

test-backend:
	@echo "Running Backend Tests..."
	cd BackEnd && make test

build-backend:
	@echo "Building Backend..."
	cd BackEnd && make build

# Frontend Detail Commands
lint-frontend:
	@echo "Linting Frontend..."
	cd FrontendNextjs/gestor && npm run lint

test-frontend:
	@echo "Running Frontend Tests..."
	cd FrontendNextjs/gestor && npm run test

build-frontend:
	@echo "Building Frontend..."
	cd FrontendNextjs/gestor && npm run build
