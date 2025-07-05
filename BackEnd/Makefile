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
	@air

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
	@go test -short -race ./...
	@echo "$(GREEN)Tests completed$(RESET)"

# Run tests with coverage (slower but complete)
test-coverage:
	@echo "$(BLUE)Running tests with coverage...$(RESET)"
	@mkdir -p $(COVERAGE_DIR)
	@go test -short -race -coverprofile=$(COVERAGE_DIR)/coverage.out ./...
	@go tool cover -html=$(COVERAGE_DIR)/coverage.out -o $(COVERAGE_DIR)/coverage.html
	@go tool cover -func=$(COVERAGE_DIR)/coverage.out | tail -n 1
	@echo "$(GREEN)Coverage report generated: $(COVERAGE_DIR)/coverage.html$(RESET)"

# Run all tests including slow benchmarks (complete but slow)
test-all:
	@echo "$(BLUE)Running all tests including slow benchmarks...$(RESET)"
	@go test -race -v ./...
	@echo "$(GREEN)All tests completed$(RESET)"

# Run unit tests only (fastest)
test-unit:
	@echo "$(BLUE)Running unit tests...$(RESET)"
	@go test -short -race ./...
	@echo "$(GREEN)Unit tests completed$(RESET)"

# Run integration tests
test-integration:
	@echo "$(BLUE)Running integration tests...$(RESET)"
	@go test -tags=integration -race ./...
	@echo "$(GREEN)Integration tests completed$(RESET)"

# Run benchmarks (optimized for speed)
benchmark:
	@echo "$(BLUE)Running benchmarks...$(RESET)"
	@go test -bench=. -benchtime=100ms -count=1 ./...
	@echo "$(GREEN)Benchmarks completed$(RESET)"

# Run comprehensive benchmarks (slower but complete)
benchmark-full:
	@echo "$(BLUE)Running comprehensive benchmarks...$(RESET)"
	@go test -bench=. -benchmem -v ./...
	@echo "$(GREEN)Comprehensive benchmarks completed$(RESET)"

# Run tests with race detection
test-race:
	@echo "$(BLUE)Running tests with race detection...$(RESET)"
	@go test -race -count=1 ./...
	@echo "$(GREEN)Race detection tests completed$(RESET)"

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
	@echo "  test-all      - Run all tests including slow benchmarks"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  test-unit     - Run unit tests only (fastest)"
	@echo "  test-integration - Run integration tests"
	@echo "  benchmark     - Run benchmarks (fast)"
	@echo "  benchmark-full - Run comprehensive benchmarks"
	@echo "  test-race     - Run tests with race detection"
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
	@echo "  health        - Check project health"
	@echo "  ci            - Run all CI checks"
	@echo "  release       - Prepare for release"
	@echo "  info          - Show project information"
	@echo "  help          - Display this help message" 