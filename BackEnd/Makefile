# Makefile for Gestor de Presupuesto Backend
# This file provides common development tasks and ensures consistent workflows

# Variables
BINARY_NAME := gestorApp
MAIN_PATH := main.go
DOCKER_IMAGE := gestor-presupuesto-backend
VERSION := $(shell git describe --tags --always --dirty)
BUILD_TIME := $(shell date +%Y-%m-%d_%H:%M:%S)
GO_VERSION := $(shell go version | cut -d " " -f 3)

# Paths
SRC_DIR := src
CMD_DIR := $(SRC_DIR)/cmd
BUILD_DIR := build
COVERAGE_DIR := coverage

# Docker settings
DOCKER_TAG := latest
DOCKER_REGISTRY := your-registry.com

# Development settings
DEV_DB_NAME := my_store_dev
TEST_DB_NAME := test
LINT_TIMEOUT := 5m

# Colors for output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
RESET := \033[0m

.PHONY: all build test clean lint fmt vet security deps docker help

# Default target
all: clean fmt lint test build

## Build Commands

# Build the application
build:
	@echo "$(BLUE)Building $(BINARY_NAME)...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@CGO_ENABLED=1 GOOS=linux go build \
		-ldflags="-X main.version=$(VERSION) -X main.buildTime=$(BUILD_TIME) -X main.goVersion=$(GO_VERSION)" \
		-o $(BUILD_DIR)/$(BINARY_NAME) \
		$(MAIN_PATH)
	@echo "$(GREEN)Build completed: $(BUILD_DIR)/$(BINARY_NAME)$(RESET)"

# Build for multiple platforms
build-all:
	@echo "$(BLUE)Building for multiple platforms...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@GOOS=linux GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 $(MAIN_PATH)
	@GOOS=darwin GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 $(MAIN_PATH)
	@GOOS=windows GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe $(MAIN_PATH)
	@echo "$(GREEN)Multi-platform build completed$(RESET)"

# Build with optimizations for production
build-prod:
	@echo "$(BLUE)Building production binary...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@CGO_ENABLED=0 GOOS=linux go build \
		-a -installsuffix cgo \
		-ldflags="-w -s -X main.version=$(VERSION) -X main.buildTime=$(BUILD_TIME)" \
		-o $(BUILD_DIR)/$(BINARY_NAME) \
		$(MAIN_PATH)
	@echo "$(GREEN)Production build completed$(RESET)"

## Development Commands

# Run the application
run:
	@echo "$(BLUE)Starting application...$(RESET)"
	@go run $(MAIN_PATH)

# Run with hot reload using air
dev:
	@echo "$(BLUE)Starting development server with hot reload...$(RESET)"
	@$(shell go env GOPATH)/bin/air

# Start development environment with database
dev-start:
	@echo "$(BLUE)Starting development environment with database...$(RESET)"
	@docker compose up -d postgres
	@echo "$(GREEN)Waiting for PostgreSQL to be ready...$(RESET)"
	@sleep 5
	@echo "$(GREEN)PostgreSQL is ready!$(RESET)"
	@echo "$(BLUE)Starting application with hot reload...$(RESET)"
	@ENV=development \
	 DB_HOST=localhost \
	 DB_PORT=5432 \
	 DB_USER=osmait \
	 DB_PASSWORD=admin123 \
	 DB_NAME=my_store \
	 DB_TYPE=postgres \
	 SERVER_HOST=localhost \
	 SERVER_PORT=8080 \
	 JWT_SECRET=your-super-secret-development-key-with-32-plus-characters-for-jwt-tokens \
	 $(shell go env GOPATH)/bin/air

# Start full development environment (backend + database + frontend)
dev-full:
	@echo "$(BLUE)Starting full development environment...$(RESET)"
	@docker-compose up -d
	@echo "$(GREEN)Full development environment started!$(RESET)"
	@echo "$(YELLOW)Services:$(RESET)"
	@echo "  - Backend: http://localhost:8080"
	@echo "  - Frontend: http://localhost:4321"
	@echo "  - Database: localhost:5432"

# Stop development environment
dev-stop:
	@echo "$(BLUE)Stopping development environment...$(RESET)"
	@docker-compose down
	@echo "$(GREEN)Development environment stopped$(RESET)"

# Restart development environment
dev-restart: dev-stop dev-start

# Show logs of development environment
dev-logs:
	@echo "$(BLUE)Showing development environment logs...$(RESET)"
	@docker-compose logs -f

# Setup development environment (first time setup)
dev-setup:
	@echo "$(BLUE)Setting up development environment...$(RESET)"
	@make dev-deps
	@echo "$(BLUE)Creating .env file for development...$(RESET)"
	@make dev-env
	@echo "$(BLUE)Starting database and running migrations...$(RESET)"
	@docker-compose up -d postgres
	@sleep 10
	@echo "$(GREEN)Development environment setup completed!$(RESET)"

# Create .env file for development
dev-env:
	@echo "$(BLUE)Creating .env file for development...$(RESET)"
	@echo "# Development Environment Configuration" > .env
	@echo "ENV=development" >> .env
	@echo "SERVER_HOST=localhost" >> .env
	@echo "SERVER_PORT=8080" >> .env
	@echo "DB_HOST=localhost" >> .env
	@echo "DB_PORT=5432" >> .env
	@echo "DB_USER=osmait" >> .env
	@echo "DB_PASSWORD=admin123" >> .env
	@echo "DB_NAME=my_store" >> .env
	@echo "DB_TYPE=postgres" >> .env
	@echo "JWT_SECRET=your-super-secret-development-key-with-32-plus-characters-for-jwt-tokens" >> .env
	@echo "SHUTDOWN_TIMEOUT=30s" >> .env
	@echo "ENABLE_METRICS=true" >> .env
	@echo "ENABLE_TRACING=true" >> .env
	@echo "ENABLE_DEBUG_MODE=true" >> .env
	@echo "LOG_LEVEL=debug" >> .env
	@echo "LOG_FORMAT=console" >> .env
	@echo "$(GREEN).env file created for development$(RESET)"

# Run database migrations
migrate:
	@echo "$(BLUE)Running database migrations...$(RESET)"
	@go run $(MAIN_PATH) migrate
	@echo "$(GREEN)Migrations completed$(RESET)"

# Reset database (dangerous - development only)
dev-reset-db:
	@echo "$(RED)WARNING: This will destroy all data in the development database!$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to cancel or Enter to continue...$(RESET)"
	@read
	@docker-compose down postgres
	@docker volume rm gestordePresupuesto_postgres_data 2>/dev/null || true
	@rm -rf postgres_data
	@echo "$(BLUE)Starting fresh database...$(RESET)"
	@docker-compose up -d postgres
	@sleep 10
	@make migrate
	@echo "$(GREEN)Database reset completed$(RESET)"

# Install development dependencies
dev-deps:
	@echo "$(BLUE)Installing development dependencies...$(RESET)"
	@go install github.com/air-verse/air@latest
	@go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@go install golang.org/x/tools/cmd/goimports@latest
	@go install github.com/securego/gosec/v2/cmd/gosec@latest
	@go install github.com/fzipp/gocyclo/cmd/gocyclo@latest
	@go install golang.org/x/vuln/cmd/govulncheck@latest
	@echo "$(GREEN)Development dependencies installed$(RESET)"

## Code Quality Commands

# Format code
fmt:
	@echo "$(BLUE)Formatting code...$(RESET)"
	@go fmt ./...
	@goimports -w -local github.com/osmait/gestorDePresupuesto .
	@echo "$(GREEN)Code formatting completed$(RESET)"

# Run static analysis
vet:
	@echo "$(BLUE)Running go vet...$(RESET)"
	@go vet ./...
	@echo "$(GREEN)Static analysis completed$(RESET)"

# Run linting
lint:
	@echo "$(BLUE)Running linters...$(RESET)"
	@golangci-lint run --timeout=$(LINT_TIMEOUT) --config=.golangci.yml
	@echo "$(GREEN)Linting completed$(RESET)"

# Fix linting issues automatically
lint-fix:
	@echo "$(BLUE)Auto-fixing linting issues...$(RESET)"
	@golangci-lint run --fix --timeout=$(LINT_TIMEOUT) --config=.golangci.yml
	@echo "$(GREEN)Auto-fix completed$(RESET)"

# Check code complexity
complexity:
	@echo "$(BLUE)Checking code complexity...$(RESET)"
	@gocyclo -over 15 .
	@echo "$(GREEN)Complexity check completed$(RESET)"

## Security Commands

# Run security analysis
security:
	@echo "$(BLUE)Running security analysis...$(RESET)"
	@gosec -fmt json -out security-report.json -stdout ./...
	@echo "$(GREEN)Security analysis completed$(RESET)"

# Check for vulnerabilities in dependencies
vuln-check:
	@echo "$(BLUE)Checking for vulnerabilities...$(RESET)"
	@govulncheck ./...
	@echo "$(GREEN)Vulnerability check completed$(RESET)"

# Audit go modules
mod-audit:
	@echo "$(BLUE)Auditing Go modules...$(RESET)"
	@go mod verify
	@go mod tidy
	@echo "$(GREEN)Module audit completed$(RESET)"

## Testing Commands

# Run all tests (fast version - skips slow benchmarks)
test:
	@echo "$(BLUE)Running tests...$(RESET)"
	@go test ./...
	@echo "$(GREEN)Tests completed$(RESET)"

# Run tests with coverage (slower but complete)
test-coverage:
	@echo "$(BLUE)Running tests with coverage...$(RESET)"
	@mkdir -p $(COVERAGE_DIR)
	@go test -short -race -coverprofile=$(COVERAGE_DIR)/coverage.out ./...
	@go tool cover -html=$(COVERAGE_DIR)/coverage.out -o $(COVERAGE_DIR)/coverage.html
	@go tool cover -func=$(COVERAGE_DIR)/coverage.out | tail -n 1
	@echo "$(GREEN)Coverage report generated: $(COVERAGE_DIR)/coverage.html$(RESET)"



## Database Commands

# Run database migrations
migrate-up:
	@echo "$(BLUE)Running database migrations...$(RESET)"
	@migrate -path cmd/api/db/migrations -database "postgres://osmait:admin123@localhost:5432/$(DEV_DB_NAME)?sslmode=disable" up
	@echo "$(GREEN)Migrations completed$(RESET)"

# Rollback database migrations
migrate-down:
	@echo "$(BLUE)Rolling back database migrations...$(RESET)"
	@migrate -path cmd/api/db/migrations -database "postgres://osmait:admin123@localhost:5432/$(DEV_DB_NAME)?sslmode=disable" down
	@echo "$(GREEN)Rollback completed$(RESET)"

# Create new migration
migrate-create:
	@read -p "Enter migration name: " name; \
	migrate create -ext sql -dir cmd/api/db/migrations -seq $$name
	@echo "$(GREEN)Migration created$(RESET)"

## Docker Commands

# Build Docker image
docker-build:
	@echo "$(BLUE)Building Docker image...$(RESET)"
	@docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	@docker tag $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_IMAGE):$(VERSION)
	@echo "$(GREEN)Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)$(RESET)"

# Run application in Docker
docker-run:
	@echo "$(BLUE)Running Docker container...$(RESET)"
	@docker run -p 8080:8080 --env-file .env $(DOCKER_IMAGE):$(DOCKER_TAG)

# Push Docker image to registry
docker-push:
	@echo "$(BLUE)Pushing Docker image to registry...$(RESET)"
	@docker tag $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG)
	@docker tag $(DOCKER_IMAGE):$(VERSION) $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(VERSION)
	@docker push $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG)
	@docker push $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(VERSION)
	@echo "$(GREEN)Docker image pushed$(RESET)"

# Start development environment with Docker Compose
docker-dev:
	@echo "$(BLUE)Starting development environment...$(RESET)"
	@docker-compose up -d
	@echo "$(GREEN)Development environment started$(RESET)"

# Stop development environment
docker-stop:
	@echo "$(BLUE)Stopping development environment...$(RESET)"
	@docker-compose down
	@echo "$(GREEN)Development environment stopped$(RESET)"

## Dependency Management

# Download dependencies
deps:
	@echo "$(BLUE)Downloading dependencies...$(RESET)"
	@go mod download
	@go mod verify
	@echo "$(GREEN)Dependencies downloaded$(RESET)"

# Clean up dependencies
deps-clean:
	@echo "$(BLUE)Cleaning dependencies...$(RESET)"
	@go mod tidy
	@go clean -modcache
	@echo "$(GREEN)Dependencies cleaned$(RESET)"

# Update dependencies
deps-update:
	@echo "$(BLUE)Updating dependencies...$(RESET)"
	@go get -u ./...
	@go mod tidy
	@echo "$(GREEN)Dependencies updated$(RESET)"

## Maintenance Commands

# Clean build artifacts
clean:
	@echo "$(BLUE)Cleaning build artifacts...$(RESET)"
	@rm -rf $(BUILD_DIR)
	@rm -rf $(COVERAGE_DIR)
	@rm -f security-report.json
	@go clean
	@echo "$(GREEN)Cleanup completed$(RESET)"

# Generate documentation
docs:
	@echo "$(BLUE)Generating documentation...$(RESET)"
	@godoc -http=:6060 &
	@echo "$(GREEN)Documentation server started at http://localhost:6060$(RESET)"

# Generate Swagger documentation
swagger:
	@echo "$(BLUE)Generating Swagger documentation...$(RESET)"
	@$(shell go env GOPATH)/bin/swag init
	@echo "$(GREEN)Swagger documentation generated$(RESET)"
	@echo "$(YELLOW)Swagger UI will be available at: http://localhost:8080/swagger/index.html$(RESET)"

# Format Swagger annotations
swagger-fmt:
	@echo "$(BLUE)Formatting Swagger annotations...$(RESET)"
	@$(shell go env GOPATH)/bin/swag fmt
	@echo "$(GREEN)Swagger annotations formatted$(RESET)"

# Install Swagger CLI tool
swagger-install:
	@echo "$(BLUE)Installing Swagger CLI tool...$(RESET)"
	@go install github.com/swaggo/swag/cmd/swag@latest
	@echo "$(GREEN)Swagger CLI tool installed$(RESET)"

# Check project health
health:
	@echo "$(BLUE)Checking project health...$(RESET)"
	@make fmt
	@make vet
	@make lint
	@make test-unit
	@make security
	@echo "$(GREEN)Project health check completed$(RESET)"

## CI/CD Commands

# Run all CI checks
ci: clean fmt lint test-coverage security
	@echo "$(GREEN)All CI checks completed$(RESET)"

# Prepare for release
release: clean test-coverage lint security build-prod
	@echo "$(GREEN)Release preparation completed$(RESET)"

## Utility Commands

# Show project information
info:
	@echo "$(BLUE)Project Information:$(RESET)"
	@echo "Binary Name: $(BINARY_NAME)"
	@echo "Version: $(VERSION)"
	@echo "Build Time: $(BUILD_TIME)"
	@echo "Go Version: $(GO_VERSION)"
	@echo "Docker Image: $(DOCKER_IMAGE):$(DOCKER_TAG)"

# Install git hooks
install-hooks:
	@echo "$(BLUE)Installing git hooks...$(RESET)"
	@cp scripts/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "$(GREEN)Git hooks installed$(RESET)"

# Display help
help:
	@echo "$(BLUE)Available commands:$(RESET)"
	@echo ""
	@echo "$(YELLOW)Build Commands:$(RESET)"
	@echo "  build         - Build the application"
	@echo "  build-all     - Build for multiple platforms"
	@echo "  build-prod    - Build production binary"
	@echo ""
	@echo "$(YELLOW)Development Commands:$(RESET)"
	@echo "  run           - Run the application"
	@echo "  dev           - Start development server with hot reload"
	@echo "  dev-deps      - Install development dependencies"
	@echo "  dev-start     - Start development environment with database"
	@echo "  dev-full      - Start full development environment (backend + database + frontend)"
	@echo "  dev-stop      - Stop development environment"
	@echo "  dev-restart   - Restart development environment"
	@echo "  dev-logs      - Show logs of development environment"
	@echo "  dev-setup     - Setup development environment (first time setup)"
	@echo "  dev-env       - Create .env file for development"
	@echo "  migrate       - Run database migrations"
	@echo "  dev-reset-db  - Reset database (dangerous - development only)"
	@echo ""
	@echo "$(YELLOW)Code Quality Commands:$(RESET)"
	@echo "  fmt           - Format code"
	@echo "  vet           - Run static analysis"
	@echo "  lint          - Run linters"
	@echo "  lint-fix      - Auto-fix linting issues"
	@echo "  complexity    - Check code complexity"
	@echo ""
	@echo "$(YELLOW)Security Commands:$(RESET)"
	@echo "  security      - Run security analysis"
	@echo "  vuln-check    - Check for vulnerabilities"
	@echo "  mod-audit     - Audit Go modules"
	@echo ""
	@echo "$(YELLOW)Testing Commands:$(RESET)"
	@echo "  test          - Run tests (fast, skips slow benchmarks)"

	@echo ""
	@echo "$(YELLOW)Database Commands:$(RESET)"
	@echo "  migrate-up    - Run database migrations"
	@echo "  migrate-down  - Rollback database migrations"
	@echo "  migrate-create - Create new migration"
	@echo ""
	@echo "$(YELLOW)Docker Commands:$(RESET)"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-run    - Run application in Docker"
	@echo "  docker-push   - Push Docker image to registry"
	@echo "  docker-dev    - Start development environment"
	@echo "  docker-stop   - Stop development environment"
	@echo ""
	@echo "$(YELLOW)Utility Commands:$(RESET)"
	@echo "  clean         - Clean build artifacts"
	@echo "  docs          - Generate documentation"
	@echo "  swagger       - Generate Swagger documentation"
	@echo "  swagger-fmt   - Format Swagger annotations"
	@echo "  swagger-install - Install Swagger CLI tool"
	@echo "  health        - Check project health"
	@echo "  ci            - Run all CI checks"
	@echo "  release       - Prepare for release"
	@echo "  info          - Show project information"
	@echo "  help          - Display this help message"
	@echo ""
	@echo "$(YELLOW)E2E Testing Commands:$(RESET)"
	@echo "  e2e           - Run all E2E tests"
	@echo "  e2e-smoke     - Run E2E smoke tests"
	@echo "  e2e-flows     - Run E2E flow tests"
	@echo "  e2e-scenarios - Run E2E scenario tests"
	@echo "  e2e-performance - Run E2E performance tests"
	@echo "  e2e-stress    - Run E2E stress tests"
	@echo "  e2e-coverage  - Generate E2E coverage report"
	@echo "  e2e-clean     - Clean E2E test containers"
	@echo "  e2e-setup     - Setup E2E test environment"
	@echo ""
	@echo "$(YELLOW)E2E Docker Commands:$(RESET)"
	@echo "  e2e-docker-up - Start E2E environment"
	@echo "  e2e-docker-down - Stop E2E environment"
	@echo "  e2e-docker-test - Run E2E tests in Docker"
	@echo "  e2e-docker-debug - Start E2E environment with debug tools"

## E2E Test Commands

# E2E Test targets
e2e:
	@echo "$(BLUE)🧪 Running E2E tests...$(RESET)"
	@./scripts/e2e-test.sh run

e2e-smoke:
	@echo "$(BLUE)🔥 Running smoke tests...$(RESET)"
	@./scripts/e2e-test.sh smoke

e2e-flows:
	@echo "$(BLUE)🌊 Running flow tests...$(RESET)"
	@./scripts/e2e-test.sh flows -v

e2e-scenarios:
	@echo "$(BLUE)🎭 Running scenario tests...$(RESET)"
	@./scripts/e2e-test.sh scenarios -v

e2e-performance:
	@echo "$(BLUE)⚡ Running performance tests...$(RESET)"
	@./scripts/e2e-test.sh performance -v

e2e-stress:
	@echo "$(BLUE)💪 Running stress tests...$(RESET)"
	@./scripts/e2e-test.sh stress -v

e2e-coverage:
	@echo "$(BLUE)📊 Generating E2E coverage report...$(RESET)"
	@./scripts/e2e-test.sh coverage

e2e-clean:
	@echo "$(BLUE)🧹 Cleaning E2E test containers...$(RESET)"
	@./scripts/e2e-test.sh clean

# E2E Docker targets
e2e-docker-up:
	@echo "$(BLUE)🐳 Starting E2E environment...$(RESET)"
	@docker-compose -f docker-compose.e2e.yml up -d postgres-e2e redis-e2e
	@echo "$(YELLOW)⏳ Waiting for services to be ready...$(RESET)"
	@sleep 10
	@echo "$(GREEN)E2E environment ready!$(RESET)"

e2e-docker-down:
	@echo "$(BLUE)🐳 Stopping E2E environment...$(RESET)"
	@docker-compose -f docker-compose.e2e.yml down -v
	@echo "$(GREEN)E2E environment stopped$(RESET)"

e2e-docker-test:
	@echo "$(BLUE)🐳 Running E2E tests in Docker...$(RESET)"
	@docker-compose -f docker-compose.e2e.yml --profile e2e up --build --abort-on-container-exit e2e-tests

e2e-docker-debug:
	@echo "$(BLUE)🐳 Starting E2E environment with debugging tools...$(RESET)"
	@docker-compose -f docker-compose.e2e.yml --profile debug up -d
	@echo "$(GREEN)E2E debug environment started!$(RESET)"
	@echo "$(YELLOW)Debug tools available:$(RESET)"
	@echo "  - Adminer (DB): http://localhost:8082"
	@echo "  - Redis Commander: http://localhost:8083"
	@echo "  - Application: http://localhost:8081"

# E2E setup and dependencies
e2e-setup:
	@echo "$(BLUE)🔧 Setting up E2E test environment...$(RESET)"
	@mkdir -p coverage
	@mkdir -p test-results
	@chmod +x scripts/e2e-test.sh
	@echo "$(GREEN)E2E test environment setup completed$(RESET)"

 
