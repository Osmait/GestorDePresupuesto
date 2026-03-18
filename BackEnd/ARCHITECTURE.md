# Backend Architecture

This document describes the architecture of the Gestor de Presupuesto backend — a Go service that provides financial management APIs with a strong emphasis on data isolation, auditability, and correctness.

## Table of Contents

- [Overview](#overview)
- [Clean Architecture Layers](#clean-architecture-layers)
- [Directory Structure](#directory-structure)
- [Core Architectural Patterns](#core-architectural-patterns)
- [Database Design](#database-design)
- [Security Model](#security-model)
- [Request Lifecycle](#request-lifecycle)
- [Testing Strategy](#testing-strategy)
- [Architectural Decision Records](#architectural-decision-records)

---

## Overview

The backend is a RESTful HTTP API built in Go. Its primary design goals are:

- **Data isolation**: Every authenticated user can only read and write their own data, enforced at the database level via PostgreSQL Row-Level Security.
- **Financial correctness**: Monetary values use `DECIMAL(19,4)` throughout; amounts are always stored positive and direction is encoded in an enum field.
- **Auditability**: Eight core financial tables are covered by a PostgreSQL trigger-based audit log.
- **Observability**: OpenTelemetry tracing, metrics, and structured Zerolog logging are wired in at the service and handler layers.
- **Security in depth**: JWT authentication, bcrypt password hashing, IP/user-based rate limiting, and database-level RLS form independent security layers.

---

## Clean Architecture Layers

```
┌───────────────────────────────────────────────────────────────────┐
│                     Frameworks & Drivers                           │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │   Gin    │  │ PostgreSQL │  │   SQLite   │  │    Zerolog    │  │
│  │ (HTTP)   │  │(production)│  │  (testing) │  │   (logging)   │  │
│  └──────────┘  └────────────┘  └────────────┘  └───────────────┘  │
├───────────────────────────────────────────────────────────────────┤
│                    Interface Adapters                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Handlers   │  │ Repositories │  │        Middleware        │ │
│  │ (per domain) │  │  (storage/)  │  │ Auth, RLS, RateLimit,    │ │
│  │              │  │              │  │ ErrorHandler, CORS       │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│                  Application Business Rules                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Services   │  │   Workers    │  │    Notification SSE      │ │
│  │ (use cases)  │  │ (background) │  │   (real-time push)       │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│                  Enterprise Business Rules                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Entities   │  │  Repository  │  │    Domain constants      │ │
│  │ (User, Acct, │  │  Interfaces  │  │ (TypeTransaction enum,   │ │
│  │  Txn, …)     │  │              │  │  roles, statuses)        │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Package path | Rules |
|---|---|---|
| **Domain** | `internal/domain/` | Pure Go structs + repository interfaces. No external imports beyond the standard library. |
| **Services** | `internal/services/` | Business logic and use cases. Depends only on domain interfaces. |
| **DTOs** | `internal/platform/dto/` | Request/response shapes. Decouples HTTP wire format from domain entities. |
| **Handlers** | `internal/platform/server/handler/` | HTTP boundary: bind, validate, call service, respond. |
| **Storage** | `internal/platform/storage/` | Repository implementations backed by PostgreSQL or SQLite. |
| **Workers** | `internal/platform/worker/` | Background goroutines (recurring transactions, demo cleanup). |

The dependency rule is strictly enforced: inner layers never import outer layers. All storage implementations satisfy domain repository interfaces.

---

## Directory Structure

```
BackEnd/
├── cmd/
│   └── api/
│       ├── bootstrap/              # Dependency injection wiring — all deps are instantiated here
│       └── db/
│           └── migrations/         # SQL migration files (000001 – 000038, up + down pairs)
│
├── internal/
│   ├── config/                     # Config struct populated from environment variables
│   │
│   ├── domain/                     # Core entities + repository interfaces (no external deps)
│   │   ├── user/
│   │   ├── account/
│   │   ├── transaction/            # Includes TypeTransaction enum (income, bill, …)
│   │   ├── category/
│   │   ├── budget/
│   │   ├── investment/
│   │   ├── notification/
│   │   ├── auth/                   # RefreshToken, AuthRequest, AuthResponse types
│   │   ├── loan/
│   │   ├── certificate/
│   │   └── savings_goal/
│   │
│   ├── services/                   # Use cases (one package per domain)
│   │   ├── auth/                   # Login, LoginWithTokens, RefreshTokens, Logout, CreateDemoUser
│   │   ├── transaction/            # Includes budget-alert notification dispatch
│   │   ├── analytics/              # Spending summaries, balance charts
│   │   ├── notification/           # SSE NotificationService
│   │   ├── ai/                     # Category suggestion, duplicate detection, reconciliation
│   │   ├── recurring_transaction/
│   │   ├── loan/
│   │   ├── certificate/
│   │   ├── creditcard/
│   │   ├── exchange/               # Exchange rate fetching
│   │   └── …
│   │
│   └── platform/
│       ├── cache/                  # In-memory TTL cache (AICacheService)
│       │
│       ├── dto/                    # Request/response DTOs (one sub-package per domain)
│       │
│       ├── server/
│       │   ├── handler/            # HTTP handlers (one package per domain)
│       │   ├── middleware/
│       │   │   ├── auth.go         # JWT validation + user lookup
│       │   │   ├── rls.go          # Opens TX, calls set_config(), stores db_tx in gin.Context
│       │   │   ├── ratelimit.go    # IP/user rate limiting
│       │   │   └── error_handler.go
│       │   ├── routes/             # Route registration (one file per domain)
│       │   └── server.go           # Server struct + registerRoutes()
│       │
│       └── storage/
│           └── postgress/
│               ├── txhelper/       # Querier interface + FromContext()
│               ├── user/
│               ├── account/
│               ├── transaction/
│               ├── auth/           # RefreshTokenRepository
│               └── test/           # SQLite integration-test helpers
│
├── docs/                           # Supplementary documentation
├── pkg/                            # Shared packages
└── go.mod
```

---

## Core Architectural Patterns

### 1. Always-Positive Amounts Convention

All monetary `amount` columns are stored as positive `DECIMAL(19,4)` values. The direction of money flow (debit vs. credit) is encoded in the `type_transation` enum field on the transaction, never in the sign of the number.

**Why**: Negative numbers in financial data are a common source of bugs in queries and aggregations. Separating sign from magnitude makes every SQL query explicit about intent.

**Balance calculation:**

```sql
SELECT
    SUM(
        CASE
            WHEN type_transation IN (
                'income',
                'loan_collection',
                'loan_cancellation_refund'
            ) THEN amount
            ELSE -amount
        END
    ) AS balance
FROM transactions
WHERE account_id = $1;
```

**Entity factory (direction is a separate field):**

```go
func NewTransaction(
    id, name, description string,
    txType TypeTransaction,   // income | bill | loan_collection | …
    accountID, categoryID string,
    amount decimal.Decimal,   // always positive
) *Transaction {
    return &Transaction{
        Id:             id,
        Name:           name,
        Description:    description,
        TypeTransation: txType,
        AccountId:      accountID,
        CategoryId:     categoryID,
        Amount:         amount,
    }
}
```

---

### 2. txhelper.FromContext — RLS-Aware Repository Access

Every authenticated request runs inside a PostgreSQL transaction that has the current user's ID configured via `set_config()`. Repositories must query through that transaction so PostgreSQL's RLS policies are evaluated correctly. The `txhelper` package provides a transparent way to achieve this.

```go
// Querier is satisfied by both *sql.DB and *sql.Tx
type Querier interface {
    ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
    QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
    QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// FromContext extracts the RLS transaction if one was stored in the Gin context,
// and falls back to the plain *sql.DB for non-authenticated paths (e.g. health checks).
func FromContext(ctx context.Context, db *sql.DB) Querier {
    if ginCtx, ok := ctx.(*gin.Context); ok {
        if txVal, exists := ginCtx.Get("db_tx"); exists {
            if tx, ok := txVal.(*sql.Tx); ok {
                return tx
            }
        }
    }
    return db
}
```

All repository methods call `txhelper.FromContext(ctx, repo.db)` instead of using `repo.db` directly:

```go
func (r *TransactionRepository) FindByAccount(
    ctx context.Context,
    accountID string,
) ([]*transaction.Transaction, error) {
    q := txhelper.FromContext(ctx, r.db) // transparent: tx or db
    rows, err := q.QueryContext(ctx, selectByAccountQuery, accountID)
    // …
}
```

---

### 3. Row-Level Security (RLS) Implementation

PostgreSQL RLS is enabled with `FORCE ROW LEVEL SECURITY` on all 22 user-owned tables. Each policy checks the transaction-scoped `app.current_user_id` setting.

**Policy pattern applied to every protected table:**

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON transactions
    USING (
        user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__'
    );
```

**RLSMiddleware (pseudocode):**

```go
func RLSMiddleware(db *sql.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetHeader("X-User-Id")
        if userID == "" {
            c.Next() // public route — skip
            return
        }

        tx, err := db.BeginTx(c.Request.Context(), nil)
        if err != nil {
            c.AbortWithError(http.StatusInternalServerError, err)
            return
        }

        // set_config(key, value, is_local=true) scopes the value to this transaction.
        // Standard SET LOCAL cannot use $1 placeholders — set_config() is required.
        _, err = tx.ExecContext(c.Request.Context(),
            `SELECT set_config('app.current_user_id', $1, true)`, userID)
        if err != nil {
            tx.Rollback()
            c.AbortWithError(http.StatusInternalServerError, err)
            return
        }

        c.Set("db_tx", tx)
        c.Next()

        if len(c.Errors) > 0 {
            tx.Rollback()
        } else {
            tx.Commit()
        }
    }
}
```

**Special cases:**
- **Background workers**: The `osmait` database role has `BYPASSRLS` privilege so scheduled jobs can operate across all users without setting a user ID.
- **Admin users**: Receive the sentinel value `__admin__` instead of their actual user ID, matching the policy's `OR` branch.

---

### 4. Middleware Chain

The middleware stack executes in the following order for every request:

```
Browser / Client
       │
       ▼
  Gin Engine
       │
       ├── cors.AllowAll()
       │
       ├── ErrorHandler
       │   └── Catches panics, formats error responses uniformly
       │
       ├── RateLimitMiddleware
       │   ├── IP-based limiting (unauthenticated requests)
       │   └── User-based limiting (authenticated, keyed on X-User-Id)
       │
       ├── [Public routes — no auth required]
       │   ├── GET  /health
       │   ├── GET  /swagger/*
       │   ├── GET  /quote
       │   └── GET  /exchange
       │
       ├── AuthMiddleware
       │   ├── Skips routes in NO_AUTH_NEEDED list (/login, /health, /ping, /metrics)
       │   ├── Validates Bearer JWT signature and expiry
       │   └── Sets X-User-Id header + User object in gin.Context
       │
       ├── RLSMiddleware
       │   ├── Skips if X-User-Id == "" (public routes fall through)
       │   ├── db.BeginTx()
       │   ├── SELECT set_config('app.current_user_id', $1, true)
       │   ├── c.Set("db_tx", tx)
       │   ├── c.Next()  ← all protected handlers run here
       │   └── Commit if no c.Errors, otherwise Rollback
       │
       └── [Protected route handlers]
```

**Auth routes (bypass both AuthMiddleware and RLSMiddleware):**

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/login` | Legacy — returns access token only |
| `POST` | `/auth/login` | Returns access token + refresh token |
| `POST` | `/auth/refresh` | Rotates refresh token |
| `POST` | `/auth/logout` | Revokes refresh token |
| `POST` | `/auth/demo` | Creates ephemeral demo user |
| `POST` | `/user` | Registration |
| `GET`  | `/user/:id` | Public profile lookup |

---

### 5. Dual-Token Authentication

The system uses two complementary tokens to balance security and usability.

| Property | Access Token | Refresh Token |
|---|---|---|
| Type | Signed JWT | Opaque random value |
| Lifetime | ~2.5 hours (configurable) | 7 days |
| Storage | Client memory / header | `refresh_tokens` table (hashed) |
| Stored as | Stateless (self-contained) | SHA-256 hash |
| Rotation | No | Yes — on every use |

**Token rotation flow:**

1. Client calls `POST /auth/refresh` with a valid refresh token.
2. Server looks up the SHA-256 hash of the presented token.
3. If found and not revoked: issue new access + refresh token pair, revoke old refresh token.
4. If the token is already marked revoked: **revoke all tokens for this user** (theft detection). The attacker and the real user are both forced to re-authenticate.

**Legacy vs. new login:**
- `POST /login` — returns access token only (backward compatible).
- `POST /auth/login` — returns access token + refresh token (preferred for all new clients).

---

### 6. Financial Audit Trail

Eight core financial tables are covered by a PostgreSQL trigger that records a full before/after snapshot for every `INSERT`, `UPDATE`, and `DELETE`.

**Tables covered:** `transactions`, `account`, `budgets`, `investments`, `savings_goals`, `loans`, `certificates`, `credit_cards`

**Trigger function (simplified):**

```sql
CREATE OR REPLACE FUNCTION fn_financial_audit()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO financial_audit_log (
        table_name,
        operation,
        row_id,
        old_data,
        new_data,
        changed_at
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

The `financial_audit_log` table is append-only and not subject to user-facing RLS modification policies, preserving the integrity of the audit record.

---

### 7. SSE Real-Time Notifications

Real-time push is implemented using `r3labs/sse` with per-user streams.

**Flow:**

1. Client opens a long-lived `GET /notifications` connection. The handler registers the stream keyed by user ID.
2. Any backend service calls `NotificationService.SendToUser(userID, payload)`.
3. `SendToUser` persists the notification to the `notifications` table (subject to RLS), then publishes it to the user's SSE stream.
4. The client receives the event immediately without polling.

**Supporting endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notifications` | Long-lived SSE stream |
| `GET` | `/notifications/history` | Paginated history |
| `PUT` | `/notifications/:id/read` | Mark single notification read |
| `PUT` | `/notifications/read-all` | Mark all read |
| `DELETE` | `/notifications` | Delete all notifications |

---

### 8. AI Services

Three AI-assisted features are powered by Google Gemini:

| Feature | Description |
|---|---|
| Category suggestion | Given a transaction name/description, suggests the most appropriate category |
| Duplicate detection | Identifies potential duplicate transactions |
| Reconciliation | AI-assisted matching of bank statement entries to recorded transactions |

All Gemini responses are cached by `AICacheService`, a thread-safe in-memory cache with TTL-based expiration, keyed on the prompt content. This avoids redundant API calls for identical inputs within the TTL window.

---

## Database Design

### Monetary Precision

All monetary columns are declared as `DECIMAL(19,4)`:

```sql
-- Example from migration 000036
ALTER TABLE transactions
    ALTER COLUMN amount TYPE DECIMAL(19,4);

ALTER TABLE account
    ALTER COLUMN initial_balance TYPE DECIMAL(19,4),
    ALTER COLUMN current_balance TYPE DECIMAL(19,4);
```

`DECIMAL(19,4)` supports values up to 999,999,999,999,999 with four decimal places — sufficient for any realistic financial figure while eliminating floating-point rounding errors.

### RLS Policy Structure

Every user-owned table follows this pattern:

```sql
-- 1. Enable RLS (read path)
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

-- 2. Force it even for the table owner role
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;

-- 3. Single policy covers SELECT, INSERT, UPDATE, DELETE
CREATE POLICY user_isolation ON <table>
    USING (
        user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__'
    )
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__'
    );
```

The `true` flag in `current_setting(..., true)` means the function returns an empty string (rather than raising an error) if the setting has not been configured — this allows unauthenticated connections to the database to proceed without error, while the policy simply matches nothing.

### Migration Strategy

- Migrations are managed by `golang-migrate` and stored as numbered up/down SQL pairs under `cmd/api/db/migrations/`.
- As of this writing the latest migration is `000038`.
- Migrations run automatically on server startup in development mode and are invoked explicitly in production via `make migrate`.
- Integration tests use SQLite in-memory databases with a separate schema that mirrors the PostgreSQL schema; migrations for the SQLite test schema are maintained in `platform/storage/postgress/test/`.

---

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Network                                           │
│  • CORS policy (AllowAll in development, restricted in prod) │
│  • TLS termination (upstream reverse proxy)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 2 — Rate Limiting                                     │
│  • IP-based limits (unauthenticated)                         │
│  • User-based limits (authenticated, keyed on X-User-Id)     │
│  • Burst allowance + automatic cleanup of stale entries      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 3 — Authentication                                    │
│  • JWT signature validation (HMAC or RSA, configurable)      │
│  • Token expiry enforcement                                  │
│  • Refresh token rotation with theft detection               │
│  • Passwords stored as bcrypt hashes (cost ≥ 12)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 4 — Application Authorization                         │
│  • Every handler receives the authenticated user from context │
│  • Service methods receive user ID and never trust client     │
│    -supplied user IDs in request bodies                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 5 — Database (RLS)                                    │
│  • FORCE ROW LEVEL SECURITY on all 22 user-owned tables      │
│  • Policies evaluated by PostgreSQL on every query           │
│  • Application bug cannot leak cross-user data               │
└─────────────────────────────────────────────────────────────┘
```

Additional protections:
- All queries use parameterized statements — no string concatenation with user input.
- Input validation at the DTO binding layer before any service code runs.
- Secret values (JWT key, DB password) sourced exclusively from environment variables.

---

## Request Lifecycle

The following traces an authenticated `POST /transaction` request end to end.

```
1. Client sends:
   POST /transaction
   Authorization: Bearer <access_token>
   Content-Type: application/json
   {"name": "Groceries", "amount": "45.20", "type": "bill", ...}

2. CORS middleware — sets response headers, passes through.

3. ErrorHandler middleware — defers panic recovery.

4. RateLimitMiddleware — checks IP/user bucket, allows request.

5. AuthMiddleware
   └─ Parses and validates the JWT.
   └─ Looks up the user record (cached or DB).
   └─ Sets c.Set("user", user) and adds X-User-Id header.

6. RLSMiddleware
   └─ db.BeginTx()
   └─ SELECT set_config('app.current_user_id', '<user-id>', true)
   └─ c.Set("db_tx", tx)
   └─ Calls c.Next() — execution continues below.

7. TransactionHandler.Create
   └─ Binds and validates request body into CreateTransactionDTO.
   └─ Calls TransactionService.Create(c, dto).

8. TransactionService.Create
   └─ Validates business rules (account belongs to user, category exists, etc.).
   └─ Calls TransactionRepository.Save(c, entity).

9. TransactionRepository.Save
   └─ txhelper.FromContext(c, r.db) → returns the *sql.Tx from step 6.
   └─ Executes INSERT INTO transactions (...) VALUES (...).
   └─ PostgreSQL evaluates RLS policy → user_id matches app.current_user_id → allowed.

10. If a budget threshold is crossed:
    └─ TransactionService dispatches a notification via NotificationService.
    └─ NotificationService inserts into notifications table (same TX).
    └─ NotificationService publishes SSE event to the user's stream.

11. Handler returns 201 Created with the transaction response DTO.

12. RLSMiddleware resumes after c.Next():
    └─ No c.Errors → tx.Commit().

13. Client receives the response and, shortly after, the SSE budget-alert event.
```

---

## Testing Strategy

### Unit Tests (go-sqlmock)

Middleware and handler logic is tested with `go-sqlmock` (DATA-DOG/go-sqlmock). Mock expectations are set for exact SQL queries, allowing tests to verify that:

- The correct query is executed.
- Parameterized values are passed correctly.
- Error paths are handled and return appropriate HTTP status codes.

```go
func TestRLSMiddleware_SetsUserConfig(t *testing.T) {
    db, mock, _ := sqlmock.New()
    mock.ExpectBegin()
    mock.ExpectQuery(`SELECT set_config`).
        WithArgs("user-123", true).
        WillReturnRows(sqlmock.NewRows([]string{""}).AddRow("user-123"))
    mock.ExpectCommit()
    // … invoke middleware, assert mock expectations met
}
```

### Integration Tests (SQLite)

Repository implementations are tested against an in-memory SQLite database. The `platform/storage/postgress/test/` package provides helpers that:

1. Open a fresh SQLite `:memory:` database.
2. Apply the test schema (DDL mirroring the PostgreSQL schema without RLS or PostgreSQL-specific types).
3. Run the test.
4. Discard the database — no cleanup needed.

This gives fast, isolated, dependency-free repository tests that exercise real SQL execution paths.

### End-to-End Tests

E2E tests (`internal/e2e/`, invoked via `make e2e`) spin up the full application stack using Docker Compose (Go server + PostgreSQL), seed data through the API, and assert on HTTP responses. These tests cover complete user workflows including authentication, transaction creation, and analytics aggregation.

### Test Commands

```bash
cd BackEnd

# Unit + integration tests
make test

# Test coverage report
make test-coverage

# E2E tests (requires Docker)
make e2e

# Security analysis
make security
```

---

## Architectural Decision Records

### ADR-001: Clean Architecture

**Context**: The project needed a structure that would support long-term maintainability, independent testability of business logic, and the ability to swap infrastructure components (e.g., PostgreSQL → SQLite for tests).

**Decision**: Adopt Clean Architecture with strict layer separation: `domain` → `services` → `platform` (adapters + frameworks).

**Consequences**:
- Business logic in `services/` is testable with mock repositories, no database required.
- Adding a new domain entity follows a clear template: entity struct in `domain/`, use cases in `services/`, repository interface in `domain/`, implementation in `storage/`.
- More files and packages than a flat structure; worthwhile at this scale.

---

### ADR-002: Always-Positive Amounts

**Context**: Financial calculations frequently broke due to mixing of signed and unsigned amount conventions across queries. A transaction with `amount = -50.00` and `type = "bill"` was indistinguishable at the schema level from a bug that produced a negative value.

**Decision**: Store all amounts as positive `DECIMAL(19,4)`. Use the `type_transation` enum to encode direction. Balance queries use `CASE WHEN` to apply sign.

**Consequences**:
- Every SQL aggregation is explicit: any negative value in the database is a data error, not a design choice.
- Application code and queries are easier to reason about.
- Migration 000036 converted existing float columns and rectified any existing negative values.

---

### ADR-003: set_config() Over SET LOCAL for RLS

**Context**: PostgreSQL's `SET LOCAL app.current_user_id = $1` is not valid syntax — the `SET` command does not accept parameter placeholders. Using string formatting to inject the user ID into a `SET` statement would create a SQL injection vulnerability.

**Decision**: Use `SELECT set_config('app.current_user_id', $1, true)` instead. The `$1` placeholder is safely bound by the driver. The `true` flag makes the setting local to the current transaction, which is equivalent to `SET LOCAL`.

**Consequences**:
- No SQL injection risk in the RLS setup path.
- The setting is automatically cleared when the transaction commits or rolls back — no leakage between requests on the same connection.

---

### ADR-004: DECIMAL(19,4) for Monetary Values

**Context**: The original schema used `FLOAT` for monetary columns. Floating-point representation of decimal fractions (e.g., 0.1 + 0.2 ≠ 0.3 in IEEE 754) causes rounding errors that accumulate silently in financial aggregations.

**Decision**: Migrate all monetary columns to `DECIMAL(19,4)`. 19 digits of precision with 4 decimal places covers values up to 999,999,999,999,999.9999, which is more than sufficient.

**Consequences**:
- Arithmetic is exact for all values representable with up to 4 decimal places.
- Slightly more storage per value than `FLOAT8`, negligible in practice.
- Migration 000036 performed the conversion on live data.

---

### ADR-005: Refresh Token Rotation

**Context**: Long-lived access tokens are a security risk: a stolen token grants access until it expires. Short-lived access tokens alone require frequent re-authentication, degrading the user experience.

**Decision**: Implement a dual-token system. Access tokens are short-lived JWTs (~2.5 hours). Refresh tokens are long-lived (7 days), stored as SHA-256 hashes in the database. On each use the refresh token is rotated (old one revoked, new one issued). If a revoked token is presented, all tokens for that user are revoked — this detects token theft and limits the blast radius.

**Consequences**:
- Compromised access tokens become useless after ~2.5 hours without any server-side action.
- Stolen refresh tokens are detected on next use (real user's refresh will present the rotated token; attacker's copy of the old token triggers revocation of all sessions).
- Requires the client to store and manage a refresh token in addition to the access token.

---

### ADR-006: txhelper.FromContext for Repository RLS Participation

**Context**: RLS requires that all queries in an authenticated request run inside the transaction where `set_config` was called. If any repository method executed queries on the bare `*sql.DB` pool, PostgreSQL would evaluate RLS with an empty `app.current_user_id` and silently return no rows (or deny writes) rather than the user's data.

**Decision**: Introduce the `Querier` interface (satisfied by both `*sql.DB` and `*sql.Tx`) and the `txhelper.FromContext()` helper. All repository methods call `FromContext` rather than using `repo.db` directly.

**Consequences**:
- Every query automatically runs inside the RLS transaction when one is available.
- The same repository code works correctly for both authenticated requests (uses `*sql.Tx`) and background workers (uses `*sql.DB`, which bypasses RLS via the `osmait` role's `BYPASSRLS` privilege).
- There is no way to accidentally write a repository method that bypasses RLS — the pattern must be actively broken.
