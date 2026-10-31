# Security Notes

## Database role and row level security

Every user-owned table has row level security **enabled and forced**
(migrations 000037, 000039 and later). The policies admit a row when its
`user_id` is the transaction's `app.current_user_id`, or when
`app.is_admin = 'true'`. The backend sets both, transaction-locally, through
`txhelper.SetRLSContext`:

| Path | Context |
|------|---------|
| Authenticated request (`RLSMiddleware`) | the user; `app.is_admin` true only for an `ADMIN` |
| MCP tools, AI routes, feature flags | the user (`txhelper.WithUserTx` / the tool transaction) |
| Async notifications | the notified user |
| Recurring scheduler | `app.is_admin` to list due rules, then each rule's user |
| Demo cleanup worker | `app.is_admin` (`txhelper.WithAdminTx`) |
| API key authentication, passkey login lookups | `app.is_admin` (`txhelper.WithAdminTx`), only before authentication; inside a request they use the request's transaction |
| Demo user creation (`/auth/demo`) | the new demo user (`txhelper.WithUserTx`) |

Tables that are read before any user is known have no RLS on purpose: `users`,
`refresh_tokens`, `mcp_oauth_*`, `webauthn_sessions`
(see `TestMigrations_UserTablesHaveForcedRLS`).

**The policies only protect anything when the role the backend connects as is
subject to them.** A role that is `SUPERUSER` or has `BYPASSRLS` sees every row
whatever the settings: the application's own `WHERE user_id = ...` filters are
then the only isolation between users. (Owning the tables is fine: `FORCE ROW
LEVEL SECURITY` applies the policies to the owner too.)

### Startup check

After the migrations the backend inspects its role and probes the policies (a
read-only transaction scoped to a random user id must see no `account` row),
then logs one line:

- `INFO row level security enforced` with `db_role`: nothing to do.
- `WARN row level security is bypassed by the database role` with `db_role`,
  `rolsuper`, `rolbypassrls`, `table_owner`, `forced` and
  `rows_visible_to_probe`: the policies are a no-op for this role. Follow the
  steps below.

The check never stops the application.

To look by hand (any SQL client, connected as the application role):

```sql
SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

### A dedicated application role on Neon

The owner role Neon creates with a project (e.g. `neondb_owner`), and roles
created from the Neon console, API or CLI, are administrative roles; do not
rely on them being subject to RLS. Keep the owner for migrations and create a
plain login role for the application **with SQL** (Neon SQL editor, connected
as the owner):

```sql
-- 1. The application role: no superuser, no RLS bypass.
CREATE ROLE gestor_app LOGIN PASSWORD '<long random password>'
    NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

-- 2. Data access on what exists today...
GRANT CONNECT ON DATABASE neondb TO gestor_app;
GRANT USAGE ON SCHEMA public TO gestor_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gestor_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gestor_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gestor_app;

-- 3. ...and on what later migrations (run by the owner) create.
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gestor_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO gestor_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO gestor_app;

-- 4. Verify.
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'gestor_app';
```

Replace `neondb` / `neondb_owner` with your database and owner names.

### Separate migration credentials

The migrations create tables, policies and triggers, so they must run as the
owner. Point the application at the new role and keep the owner for the
migrator only:

| Variable | Value |
|----------|-------|
| `DB_USER` / `DB_PASSWORD` | `gestor_app` and its password (every request, worker and MCP call) |
| `DB_MIGRATION_USER` / `DB_MIGRATION_PASSWORD` | the owner (`neondb_owner`) and its password, used only by the migrations at startup |

Host, database name and `DB_SSL_MODE` are shared. Without `DB_MIGRATION_USER`
the migrations use `DB_USER`, as before.

### Rollout

1. Deploy, and read the startup line. If it already says `enforced`, stop here.
2. Create `gestor_app` as above and set the four variables.
3. Redeploy and check for `row level security enforced db_role=gestor_app`.
4. Smoke test the paths that run without a user's request transaction:
   password login, passkey login, an MCP call with an API key, the Claude
   connector (OAuth), `/auth/demo`, and an admin user listing. The integration
   test `TestRLSRole_SystemPathsUnderForcedRLS` covers them against a
   `NOSUPERUSER NOBYPASSRLS` role.

Rolling back is setting `DB_USER` / `DB_PASSWORD` back to the owner.

Local development: migration 000037 grants `BYPASSRLS` to the `osmait` role
when it exists, so a local database logs the warning; that is expected there.
