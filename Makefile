
.PHONY: frontend backend dev services help

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
	@echo "  make frontend   - Start the Next.js Frontend"
	@echo "  make backend    - Start the Go Backend (with Air)"
	@echo "  make services   - Start Backend Database services (Docker)"
	@echo "  make test-e2e   - Run Playwright E2E tests"

# E2E Tests
test-e2e:
	@echo "Running E2E Tests..."
	cd e2e-test && npx playwright test
