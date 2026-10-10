// Package db embeds the SQL migrations into the binary so the application
// does not depend on the process working directory to find them.
package db

import "embed"

// MigrationsDir is the directory inside Migrations that holds the *.sql files.
const MigrationsDir = "migrations"

// Migrations holds every golang-migrate migration file.
//
//go:embed migrations/*.sql
var Migrations embed.FS
