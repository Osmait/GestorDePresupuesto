package txhelper

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
)

// RLSStatus is what CheckRowLevelSecurity found about the database role the
// application connects as.
type RLSStatus struct {
	// Role is current_user.
	Role string
	// Superuser and BypassRLS are the role's rolsuper / rolbypassrls: either
	// one makes every row level security policy a no-op.
	Superuser bool
	BypassRLS bool
	// TableOwner reports whether the role owns the probe table; owners are
	// subject to RLS only because the tables use FORCE ROW LEVEL SECURITY.
	TableOwner bool
	// Forced reports whether the probe table has RLS enabled and forced.
	Forced bool
	// LeakedRows reports whether the live probe, scoped to a random user
	// that owns nothing, could still see rows of the probe table.
	LeakedRows bool
}

// Enforced reports whether the policies apply to the application's queries.
func (s RLSStatus) Enforced() bool {
	return !s.Superuser && !s.BypassRLS && s.Forced && !s.LeakedRows
}

// rlsProbeTable is a user-owned table under FORCE ROW LEVEL SECURITY
// (migration 000037) that every installation has.
const rlsProbeTable = "account"

// CheckRowLevelSecurity inspects the database role the pool connects as and
// probes the policies for real: in a transaction scoped like a request of a
// random user id that owns nothing (app.is_admin false), no row of the
// account table may be visible. A role that is superuser or has BYPASSRLS
// sees every row and makes every policy a no-op; the catalog flags catch it
// even when the table is empty. The transaction only reads.
//
// It runs at startup, before the server takes requests, through InTx (no
// request transaction exists yet).
func CheckRowLevelSecurity(ctx context.Context, db *sql.DB) (RLSStatus, error) {
	var status RLSStatus
	probeUser, err := randomProbeUser()
	if err != nil {
		return status, err
	}
	err = InTx(ctx, db, func(q Querier) error {
		if err := q.QueryRowContext(ctx,
			`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
		).Scan(&status.Role, &status.Superuser, &status.BypassRLS); err != nil {
			return fmt.Errorf("read role attributes: %w", err)
		}
		if err := q.QueryRowContext(ctx,
			`SELECT c.relrowsecurity AND c.relforcerowsecurity, pg_get_userbyid(c.relowner) = current_user
			 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE n.nspname = current_schema() AND c.relname = $1`, rlsProbeTable,
		).Scan(&status.Forced, &status.TableOwner); err != nil {
			return fmt.Errorf("read %s row level security flags: %w", rlsProbeTable, err)
		}
		if err := SetRLSContext(ctx, q, probeUser, false); err != nil {
			return fmt.Errorf("set probe rls context: %w", err)
		}
		if err := q.QueryRowContext(ctx,
			`SELECT EXISTS (SELECT 1 FROM `+rlsProbeTable+`)`,
		).Scan(&status.LeakedRows); err != nil {
			return fmt.Errorf("probe %s: %w", rlsProbeTable, err)
		}
		return nil
	})
	return status, err
}

func randomProbeUser() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "rls-probe-" + hex.EncodeToString(b), nil
}
