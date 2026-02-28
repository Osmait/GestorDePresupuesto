package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

var testDB *sql.DB

func TestMain(m *testing.M) {
	ctx := context.Background()

	req := testcontainers.ContainerRequest{
		Image:        "postgres:17-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_DB":       "testdb",
			"POSTGRES_USER":     "test",
			"POSTGRES_PASSWORD": "test",
		},
		WaitingFor: wait.ForLog("database system is ready to accept connections").
			WithOccurrence(2).
			WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		log.Fatalf("failed to start postgres container: %v", err)
	}
	defer func() {
		if err := container.Terminate(ctx); err != nil {
			log.Printf("failed to terminate container: %v", err)
		}
	}()

	host, err := container.Host(ctx)
	if err != nil {
		log.Fatalf("failed to get container host: %v", err)
	}

	mappedPort, err := container.MappedPort(ctx, "5432/tcp")
	if err != nil {
		log.Fatalf("failed to get mapped port: %v", err)
	}

	connStr := fmt.Sprintf("postgres://test:test@%s:%s/testdb?sslmode=disable", host, mappedPort.Port())

	testDB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("failed to open test database: %v", err)
	}

	_, filename, _, _ := runtime.Caller(0)
	migrationsDir, _ := filepath.Abs(filepath.Join(filepath.Dir(filename), "../../../../../cmd/api/db/migrations"))
	utils.RunDBMigration("file://"+filepath.ToSlash(migrationsDir), connStr)

	os.Exit(m.Run())
}

func SetUpTest() *sql.DB {
	return testDB
}

func SetUpTestWithCleanup() (*sql.DB, func()) {
	return testDB, func() {}
}
