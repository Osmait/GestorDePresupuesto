//go:build e2e
// +build e2e

package e2e

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/suite"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/osmait/gestorDePresupuesto/cmd/api/boostrap"
	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/e2e/helpers"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"

	_ "github.com/lib/pq"
)

// E2ETestSuite defines the test suite for end-to-end tests.
//
// The HTTP application under test is built with boostrap.NewApp — the same
// wiring cmd/api uses in production (every repository, service, middleware and
// route, including AuthMiddleware and the per-request RLS transaction) — so
// the suite cannot drift from the real server. Configuration comes from
// config.LoadConfig with only the environment variables below overridden.
type E2ETestSuite struct {
	suite.Suite
	server      *httptest.Server
	engine      *gin.Engine
	dbContainer *postgres.PostgresContainer
	db          *sql.DB
	config      *config.Config
	cancelApp   context.CancelFunc
	helpers     *helpers.TestHelpers
}

const e2eJWTSecret = "e2e-test-secret-key-very-long-and-secure"

// SetupSuite runs once before all tests in the suite
func (suite *E2ETestSuite) SetupSuite() {
	ctx := context.Background()

	// Setup test database with testcontainers
	log.Println("Setting up test database container...")
	dbContainer, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("e2e_testdb"),
		postgres.WithUsername("e2e_user"),
		postgres.WithPassword("e2e_password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	suite.Require().NoError(err)
	suite.dbContainer = dbContainer

	host, err := dbContainer.Host(ctx)
	suite.Require().NoError(err)

	port, err := dbContainer.MappedPort(ctx, "5432")
	suite.Require().NoError(err)

	// Load configuration exactly as production does, pointing it at the
	// container. Only what the test environment needs is overridden.
	t := suite.T()
	for key, value := range map[string]string{
		"ENV":                     "test",
		"JWT_SECRET":              e2eJWTSecret,
		"DB_TYPE":                 "postgres",
		"DB_HOST":                 host,
		"DB_PORT":                 port.Port(),
		"DB_USER":                 "e2e_user",
		"DB_PASSWORD":             "e2e_password",
		"DB_NAME":                 "e2e_testdb",
		"DB_SSL_MODE":             "disable",
		"LOG_LEVEL":               "error",
		"RATE_LIMIT_ENABLED":      "true",
		"RATE_LIMIT_IP_WHITELIST": "127.0.0.1,::1",
		"TRUSTED_PROXIES":         "",
		"MCP_ENABLED":             "false",
		"GEMINI_API_KEY":          "",
		"ADMIN_SEED_ENABLED":      "false",
	} {
		t.Setenv(key, value)
	}
	suite.config, err = config.LoadConfig()
	suite.Require().NoError(err)

	suite.db, err = sql.Open("postgres", suite.config.GetPostgresUrl())
	suite.Require().NoError(err)
	suite.db.SetMaxOpenConns(suite.config.Database.MaxOpenConns)
	suite.db.SetMaxIdleConns(suite.config.Database.MaxIdleConns)
	suite.Require().NoError(suite.db.Ping())

	// Run the embedded migrations, as the production binary does.
	log.Println("Running database migrations...")
	suite.Require().NoError(utils.RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, suite.config.GetPostgresUrl()))

	// Build the real application router.
	gin.SetMode(gin.TestMode)
	appCtx, cancel := context.WithCancel(ctx)
	suite.cancelApp = cancel
	app, err := boostrap.NewApp(appCtx, suite.config, suite.db)
	suite.Require().NoError(err)
	suite.engine = app.Server.Engine

	suite.server = httptest.NewServer(suite.engine)
	log.Printf("Test server started at: %s", suite.server.URL)

	suite.helpers = helpers.NewTestHelpers(suite.server.URL, suite.config)
}

// TearDownSuite runs once after all tests in the suite
func (suite *E2ETestSuite) TearDownSuite() {
	log.Println("Tearing down test suite...")

	if suite.helpers != nil {
		suite.helpers.Close()
	}

	if suite.server != nil {
		suite.server.Close()
	}

	if suite.cancelApp != nil {
		suite.cancelApp()
	}

	if suite.db != nil {
		_ = suite.db.Close()
	}

	if suite.dbContainer != nil {
		ctx := context.Background()
		if err := suite.dbContainer.Terminate(ctx); err != nil {
			log.Printf("Error terminating container: %v", err)
		}
	}
}

// SetupTest runs before each individual test
func (suite *E2ETestSuite) SetupTest() {
	suite.cleanDatabase()
}

// cleanDatabase empties every application table (all of public except the
// migration bookkeeping) so each test starts from a blank database.
func (suite *E2ETestSuite) cleanDatabase() {
	if suite.db == nil {
		return
	}

	rows, err := suite.db.Query(`SELECT quote_ident(tablename) FROM pg_tables
		WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`)
	suite.Require().NoError(err)
	var tables []string
	for rows.Next() {
		var name string
		suite.Require().NoError(rows.Scan(&name))
		tables = append(tables, name)
	}
	suite.Require().NoError(rows.Err())
	suite.Require().NoError(rows.Close())

	if len(tables) == 0 {
		return
	}
	_, err = suite.db.Exec(fmt.Sprintf("TRUNCATE %s RESTART IDENTITY CASCADE", strings.Join(tables, ", ")))
	suite.Require().NoError(err)
}

// TestMain is the entry point for running E2E tests
func TestMain(m *testing.M) {
	// Set required environment for Docker
	if os.Getenv("DOCKER_HOST") == "" {
		if err := os.Setenv("DOCKER_HOST", "unix:///var/run/docker.sock"); err != nil {
			log.Fatalf("set DOCKER_HOST: %v", err)
		}
	}

	os.Exit(m.Run())
}

// TestE2ETestSuite runs the entire E2E test suite
func TestE2ETestSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E tests in short mode")
	}

	suite.Run(t, new(E2ETestSuite))
}
