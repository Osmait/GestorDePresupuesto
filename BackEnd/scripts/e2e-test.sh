#!/bin/bash

# E2E Test Automation Script for GestorDePresupuesto
# This script automates the complete E2E testing process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
E2E_TIMEOUT=${E2E_TIMEOUT:-10m}
E2E_PARALLEL=${E2E_PARALLEL:-4}
E2E_VERBOSE=${E2E_VERBOSE:-false}
CLEANUP_ON_EXIT=${CLEANUP_ON_EXIT:-true}

# Directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_DIR="${PROJECT_ROOT}/internal/e2e"
COVERAGE_DIR="${PROJECT_ROOT}/coverage"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Go version
    if ! command -v go &> /dev/null; then
        log_error "Go is not installed"
        exit 1
    fi
    
    GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
    log_info "Go version: $GO_VERSION"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "All dependencies are available"
}

setup_environment() {
    log_info "Setting up test environment..."
    
    # Create coverage directory
    mkdir -p "${COVERAGE_DIR}"
    
    # Set test environment variables
    export E2E_TEST_MODE=true
    export GIN_MODE=test
    export LOG_LEVEL=error
    
    # Set Docker environment
    export DOCKER_HOST=${DOCKER_HOST:-unix:///var/run/docker.sock}
    
    log_success "Test environment set up"
}

cleanup_containers() {
    log_info "Cleaning up test containers..."
    
    # Remove any existing test containers
    docker ps -a --filter "label=testcontainers" --format "{{.ID}}" | xargs -r docker rm -f
    
    # Clean up test networks
    docker network ls --filter "name=testcontainers" --format "{{.ID}}" | xargs -r docker network rm
    
    log_success "Containers cleaned up"
}

run_unit_tests() {
    log_info "Running unit tests first..."
    
    cd "${PROJECT_ROOT}"
    
    # Run unit tests to ensure basic functionality works
    go test -short -race -coverprofile="${COVERAGE_DIR}/unit.out" ./... || {
        log_error "Unit tests failed. Fix unit tests before running E2E tests."
        exit 1
    }
    
    log_success "Unit tests passed"
}

run_e2e_tests() {
    log_info "Running E2E tests..."
    
    cd "${PROJECT_ROOT}"
    
    # Build test flags
    TEST_FLAGS="-tags=e2e"
    TEST_FLAGS="$TEST_FLAGS -timeout=${E2E_TIMEOUT}"
    TEST_FLAGS="$TEST_FLAGS -parallel=${E2E_PARALLEL}"
    TEST_FLAGS="$TEST_FLAGS -coverprofile=${COVERAGE_DIR}/e2e.out"
    
    if [ "$E2E_VERBOSE" = "true" ]; then
        TEST_FLAGS="$TEST_FLAGS -v"
    fi
    
    # Run E2E tests
    log_info "Executing: go test $TEST_FLAGS ./internal/e2e/..."
    
    if go test $TEST_FLAGS ./internal/e2e/...; then
        log_success "E2E tests passed!"
    else
        log_error "E2E tests failed!"
        return 1
    fi
}

run_specific_test() {
    local test_name="$1"
    log_info "Running specific test: $test_name"
    
    cd "${PROJECT_ROOT}"
    
    TEST_FLAGS="-tags=e2e -timeout=${E2E_TIMEOUT} -v"
    
    if go test $TEST_FLAGS ./internal/e2e/... -run "$test_name"; then
        log_success "Test $test_name passed!"
    else
        log_error "Test $test_name failed!"
        return 1
    fi
}

run_test_suite() {
    local suite_name="$1"
    log_info "Running test suite: $suite_name"
    
    cd "${PROJECT_ROOT}"
    
    case "$suite_name" in
        "flows")
            go test -tags=e2e -timeout=${E2E_TIMEOUT} -v ./internal/e2e/flows/...
            ;;
        "scenarios")
            go test -tags=e2e -timeout=${E2E_TIMEOUT} -v ./internal/e2e/scenarios/...
            ;;
        "all")
            run_e2e_tests
            ;;
        *)
            log_error "Unknown test suite: $suite_name"
            log_info "Available suites: flows, scenarios, all"
            exit 1
            ;;
    esac
}

generate_coverage_report() {
    log_info "Generating coverage report..."
    
    cd "${PROJECT_ROOT}"
    
    # Combine coverage files if they exist
    if [ -f "${COVERAGE_DIR}/unit.out" ] && [ -f "${COVERAGE_DIR}/e2e.out" ]; then
        # Merge coverage files
        echo "mode: atomic" > "${COVERAGE_DIR}/combined.out"
        tail -n +2 "${COVERAGE_DIR}/unit.out" >> "${COVERAGE_DIR}/combined.out"
        tail -n +2 "${COVERAGE_DIR}/e2e.out" >> "${COVERAGE_DIR}/combined.out"
        
        # Generate HTML report
        go tool cover -html="${COVERAGE_DIR}/combined.out" -o "${COVERAGE_DIR}/coverage.html"
        
        # Generate summary
        COVERAGE_PERCENT=$(go tool cover -func="${COVERAGE_DIR}/combined.out" | grep "total:" | awk '{print $3}')
        log_success "Total coverage: $COVERAGE_PERCENT"
        log_info "Coverage report generated: ${COVERAGE_DIR}/coverage.html"
    else
        log_warning "Coverage files not found"
    fi
}

performance_test() {
    log_info "Running performance tests..."
    
    cd "${PROJECT_ROOT}"
    
    # Run specific performance-related tests
    go test -tags=e2e -timeout=${E2E_TIMEOUT} -v ./internal/e2e/scenarios/... -run "TestConcurrentRequests|TestLargeDatasets|TestRateLimiting"
    
    log_success "Performance tests completed"
}

stress_test() {
    log_info "Running stress tests..."
    
    cd "${PROJECT_ROOT}"
    
    # Set higher concurrency for stress testing
    export E2E_PARALLEL=10
    
    # Run stress-related tests multiple times
    for i in {1..3}; do
        log_info "Stress test iteration $i/3"
        go test -tags=e2e -timeout=15m -v ./internal/e2e/scenarios/... -run "TestConcurrentRequests|TestMemoryAndResourceUsage"
    done
    
    log_success "Stress tests completed"
}

smoke_test() {
    log_info "Running smoke tests..."
    
    cd "${PROJECT_ROOT}"
    
    # Run basic flow tests only
    go test -tags=e2e -timeout=5m -v ./internal/e2e/... -run "TestCompleteUserFlow"
    
    log_success "Smoke tests completed"
}

cleanup_on_exit() {
    if [ "$CLEANUP_ON_EXIT" = "true" ]; then
        log_info "Cleaning up on exit..."
        cleanup_containers
    fi
}

show_usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
    run                 Run all E2E tests (default)
    flows               Run flow tests only
    scenarios           Run scenario tests only  
    test <name>         Run specific test by name
    smoke               Run smoke tests only
    performance         Run performance tests
    stress              Run stress tests
    coverage            Generate coverage report
    clean               Clean up test containers
    help                Show this help message

Options:
    -v, --verbose       Enable verbose output
    -t, --timeout <n>   Set test timeout (default: 10m)
    -p, --parallel <n>  Set parallel execution count (default: 4)
    --no-cleanup        Don't clean up containers on exit

Environment Variables:
    E2E_TIMEOUT         Test timeout (default: 10m)
    E2E_PARALLEL        Parallel execution count (default: 4)
    E2E_VERBOSE         Enable verbose output (default: false)
    CLEANUP_ON_EXIT     Clean up containers on exit (default: true)

Examples:
    $0 run                          # Run all E2E tests
    $0 smoke                        # Run smoke tests only
    $0 test CompleteUserFlow        # Run specific test
    $0 flows -v                     # Run flow tests with verbose output
    $0 performance                  # Run performance tests
    $0 stress                       # Run stress tests
    $0 coverage                     # Generate coverage report

EOF
}

# Parse command line arguments
COMMAND="run"
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            E2E_VERBOSE=true
            shift
            ;;
        -t|--timeout)
            E2E_TIMEOUT="$2"
            shift 2
            ;;
        -p|--parallel)
            E2E_PARALLEL="$2"
            shift 2
            ;;
        --no-cleanup)
            CLEANUP_ON_EXIT=false
            shift
            ;;
        run|flows|scenarios|smoke|performance|stress|coverage|clean|help)
            COMMAND="$1"
            shift
            ;;
        test)
            COMMAND="test"
            TEST_NAME="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set up trap for cleanup
trap cleanup_on_exit EXIT

# Main execution
case "$COMMAND" in
    "run")
        check_dependencies
        setup_environment
        cleanup_containers
        run_unit_tests
        run_e2e_tests
        generate_coverage_report
        ;;
    "flows")
        check_dependencies
        setup_environment
        cleanup_containers
        run_test_suite "flows"
        ;;
    "scenarios")
        check_dependencies
        setup_environment
        cleanup_containers
        run_test_suite "scenarios"
        ;;
    "test")
        if [ -z "$TEST_NAME" ]; then
            log_error "Test name is required"
            show_usage
            exit 1
        fi
        check_dependencies
        setup_environment
        cleanup_containers
        run_specific_test "$TEST_NAME"
        ;;
    "smoke")
        check_dependencies
        setup_environment
        cleanup_containers
        smoke_test
        ;;
    "performance")
        check_dependencies
        setup_environment
        cleanup_containers
        performance_test
        ;;
    "stress")
        check_dependencies
        setup_environment
        cleanup_containers
        stress_test
        ;;
    "coverage")
        generate_coverage_report
        ;;
    "clean")
        cleanup_containers
        ;;
    "help")
        show_usage
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac

log_success "E2E test automation completed successfully!" 