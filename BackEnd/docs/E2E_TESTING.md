# End-to-End (E2E) Testing Guide

## Overview

This document provides comprehensive guidance on running and maintaining end-to-end tests for the GestorDePresupuesto backend API. Our E2E testing framework ensures that the complete user journey works correctly across all system components.

## 🎯 What Are E2E Tests?

End-to-end tests validate the complete application flow from user interaction to database persistence. They test:

- **Complete user journeys** (registration → login → account management → transactions)
- **API integration** between all components
- **Database operations** and data consistency
- **Business logic** across service boundaries
- **Error handling** and edge cases
- **Performance** under load

## 📁 Test Structure

```
internal/e2e/
├── setup_test.go              # Test suite setup with testcontainers
├── helpers/
│   └── test_helpers.go        # HTTP requests, auth, and DB utilities
├── flows/
│   └── user_flow_test.go      # Complete user journey tests
└── scenarios/
    ├── error_scenarios_test.go # Error handling and validation tests
    └── edge_cases_test.go      # Performance, concurrency, and limits
```

## 🚀 Quick Start

### Prerequisites

- **Go 1.21+**
- **Docker** and **Docker Compose**
- **Git** for version control

### Setup E2E Environment

```bash
# Setup E2E testing environment
make e2e-setup
```

PostgreSQL is started automatically by testcontainers; no compose stack is needed.

### Run Tests

```bash
# Run all E2E tests
make e2e

# Run smoke tests (quick validation)
make e2e-smoke

# Run specific test suites
make e2e-flows        # User journey tests
make e2e-scenarios    # Error and edge case tests
```

## 📋 Test Categories

### 1. Flow Tests (`internal/e2e/flows/`)

**Purpose**: Test complete user journeys and business workflows

**Test Cases**:
- **Complete User Flow**: Registration → Login → Account creation → Transactions → Budget management
- **Multiple Users Isolation**: Ensure user data remains isolated
- **Account Management**: Creation, deletion, and balance updates
- **Cross-service Integration**: Data consistency across services

**Example**:
```bash
make e2e-flows
```

### 2. Error Scenarios (`internal/e2e/scenarios/error_scenarios_test.go`)

**Purpose**: Validate error handling and input validation

**Test Cases**:
- **Input Validation**: Invalid emails, short passwords, missing fields
- **Authentication Errors**: Wrong credentials, expired tokens
- **Authorization Failures**: Access without valid JWT, invalid permissions
- **Resource Not Found**: Nonexistent IDs, deleted resources
- **Duplicate Data**: Unique constraint violations
- **Malformed Requests**: Invalid JSON, incorrect data types

**Example**:
```bash
./scripts/e2e-test.sh test UserValidationErrors
```

### 3. Edge Cases (`internal/e2e/scenarios/edge_cases_test.go`)

**Purpose**: Test system limits, performance, and boundary conditions

**Test Cases**:
- **Large Datasets**: 50+ accounts, 100+ transactions
- **Concurrent Operations**: Multiple simultaneous requests
- **Boundary Values**: Large amounts, long strings, special characters
- **Rate Limiting**: Rapid request handling
- **Resource Management**: Memory usage patterns

**Example**:
```bash
make e2e-performance
```

## 🛠️ Available Commands

### Basic E2E Commands

| Command | Description |
|---------|-------------|
| `make e2e` | Run all E2E tests |
| `make e2e-smoke` | Run quick smoke tests |
| `make e2e-flows` | Run user flow tests |
| `make e2e-scenarios` | Run error scenario tests |

### Performance Testing

| Command | Description |
|---------|-------------|
| `make e2e-performance` | Run performance tests |
| `make e2e-stress` | Run stress tests (multiple iterations) |

### Utilities

| Command | Description |
|---------|-------------|
| `make e2e-coverage` | Generate coverage report |
| `make e2e-clean` | Clean test containers |
| `make e2e-setup` | Setup E2E environment |

## 🐳 Docker Testing

The suites start their own PostgreSQL container through testcontainers
(`postgres:17-alpine`), so only a running Docker daemon is required. For a
manual database, use the `testdb` service of `docker-compose.yaml`
(`docker compose up -d testdb`, port 5433).

## 📊 Coverage and Reporting

### Generate Coverage Report

```bash
# Run tests with coverage
make e2e-coverage

# View HTML report
open coverage/coverage.html
```

### CI Integration

The API E2E suite runs in GitHub Actions as the `backend-e2e` job of
`.github/workflows/backend.yaml` (repository root):

```yaml
- name: E2E Tests
  run: make e2e-api
```

## 🧪 Writing E2E Tests

### Test Structure

```go
func (suite *E2ETestSuite) TestYourFeature() {
    suite.Run("YourFeature", func() {
        // 1. Setup test data
        userData := suite.helpers.CreateUserFlow("feature")
        
        // 2. Execute operations
        resp := suite.helpers.MakeRequest("POST", "/endpoint", data, userData.Token)
        
        // 3. Verify results
        suite.Equal(http.StatusOK, resp.StatusCode)
        
        // 4. Check database state
        count := suite.helpers.CountRecords("table_name")
        suite.Equal(1, count)
    })
}
```

### Best Practices

1. **Use Helper Functions**: Leverage `suite.helpers` for common operations
2. **Clean State**: Each test starts with a clean database
3. **Meaningful Names**: Use descriptive test and subtest names
4. **Complete Flows**: Test entire user journeys, not just individual endpoints
5. **Error Validation**: Always test both success and failure scenarios
6. **Database Verification**: Check database state after operations

### Helper Functions

```go
// User management
token, userData := suite.helpers.RegisterAndLoginUser("suffix")
completeUser := suite.helpers.CreateUserFlow("suffix")

// HTTP requests
resp := suite.helpers.MakeRequest("GET", "/endpoint", nil, token)

// Database operations
count := suite.helpers.CountRecords("users")
suite.helpers.ExecuteSQL("DELETE FROM users")

// Test data creation
userData := suite.helpers.CreateTestUser("suffix")
accountData := suite.helpers.CreateTestAccount("suffix")
```

## ⚡ Performance Considerations

### Test Execution Time

- **Smoke Tests**: ~30 seconds (basic flows)
- **Full E2E Suite**: ~5-10 minutes (all scenarios)
- **Performance Tests**: ~10-15 minutes (load testing)
- **Stress Tests**: ~20-30 minutes (repeated executions)

### Optimization Tips

1. **Parallel Execution**: Tests run in parallel where possible
2. **Test Containers**: Each test suite gets isolated containers
3. **Database Cleanup**: Efficient cleanup between tests
4. **Resource Limits**: Controlled resource usage

## 🔧 Configuration

### Environment Variables

```bash
# Test configuration
E2E_TIMEOUT=10m           # Test timeout
E2E_PARALLEL=4            # Parallel execution count
E2E_VERBOSE=false         # Verbose output
CLEANUP_ON_EXIT=true      # Clean containers on exit

# Database configuration (testcontainers)
DB_TYPE=postgres
DB_HOST=auto-generated    # Testcontainer host
DB_PORT=auto-generated    # Testcontainer port
```

## 🚨 Troubleshooting

### Common Issues

#### Docker Permission Issues
```bash
# Fix Docker socket permissions
sudo chmod 666 /var/run/docker.sock
```

#### Port Conflicts
```bash
# Check port usage
sudo lsof -i :5433
sudo lsof -i :8081

# Remove leftover test containers
make e2e-clean
```

#### Test Timeouts
```bash
# Increase timeout
E2E_TIMEOUT=20m make e2e
```

#### Database Connection Issues
```bash
# Check the testcontainers PostgreSQL container
docker ps --filter "label=org.testcontainers=true"

# View its logs
docker logs <container-id>
```

### Debug Mode

```bash
# Enable verbose output
E2E_VERBOSE=true make e2e-flows

# Run specific test with debug
./scripts/e2e-test.sh test "TestCompleteUserFlow" -v

# Keep containers running for inspection
CLEANUP_ON_EXIT=false make e2e
```

## 📈 Monitoring and Metrics

### Test Metrics

The E2E tests collect various metrics:

- **Execution Time**: Per test and overall suite
- **Success Rate**: Pass/fail ratios
- **Coverage**: Code coverage from E2E tests
- **Resource Usage**: Memory and CPU during tests

### Performance Benchmarks

Key performance indicators tracked:

- **User Registration**: < 500ms
- **Login**: < 200ms
- **Account Creation**: < 300ms
- **Transaction Processing**: < 400ms
- **Large Dataset Handling**: 100+ transactions < 5s

## 🔄 Continuous Integration

### GitHub Actions Integration

```yaml
# E2E tests run on:
- Pull requests (smoke tests)
- Main branch pushes (full suite)
- Scheduled runs (daily performance tests)
- Manual triggers (stress tests)
```

### Local CI Simulation

```bash
# Simulate CI environment
make test-ci-full
```

## 📚 Additional Resources

- [Go Testing Best Practices](https://golang.org/doc/tutorial/add-a-test)
- [Testcontainers Documentation](https://golang.testcontainers.org/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [GitHub Actions Guide](https://docs.github.com/en/actions)

## 🤝 Contributing

When adding new E2E tests:

1. **Follow the existing structure** and naming conventions
2. **Add to appropriate category** (flows, scenarios, edge cases)
3. **Include both success and failure scenarios**
4. **Update this documentation** with new test descriptions
5. **Ensure tests are deterministic** and can run in any order

## 📞 Support

For E2E testing issues:

1. Check this documentation first
2. Review troubleshooting section
3. Enable verbose mode for debugging
4. Check GitHub Issues for known problems
5. Create an issue with detailed logs if needed

---

**Happy Testing! 🧪✨** 