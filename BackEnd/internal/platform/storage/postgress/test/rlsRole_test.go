package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	apikeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/apikey"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	passkeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/passkey"
	recurringRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/recurring_transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	apikeyService "github.com/osmait/gestorDePresupuesto/internal/services/apikey"
	authService "github.com/osmait/gestorDePresupuesto/internal/services/auth"
	recurringService "github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	userService "github.com/osmait/gestorDePresupuesto/internal/services/user"
)

// The startup check tells a role that bypasses row level security (the
// superuser of the test container) from one the policies apply to.
func TestCheckRowLevelSecurity(t *testing.T) {
	ctx := context.Background()
	// The probe must have rows to (not) see.
	seedLedgerUser(t, testDB)

	owner, err := txhelper.CheckRowLevelSecurity(ctx, testDB)
	require.NoError(t, err)
	assert.Equal(t, "test", owner.Role)
	assert.True(t, owner.Superuser)
	assert.True(t, owner.Forced)
	assert.True(t, owner.LeakedRows, "a superuser sees every row")
	assert.False(t, owner.Enforced())

	rls := openRLSRole(t)
	app, err := txhelper.CheckRowLevelSecurity(ctx, rls)
	require.NoError(t, err)
	assert.False(t, app.Superuser)
	assert.False(t, app.BypassRLS)
	assert.False(t, app.TableOwner)
	assert.True(t, app.Forced)
	assert.False(t, app.LeakedRows)
	assert.True(t, app.Enforced())
}

// Every path that runs without a user's request transaction keeps working
// under a role subject to FORCE ROW LEVEL SECURITY (NOSUPERUSER NOBYPASSRLS,
// the recommended production role): demo user creation, API key and passkey
// lookups before authentication, the demo cleanup worker, the recurring
// scheduler and admin listings. None of them may widen a user's request.
func TestRLSRole_SystemPathsUnderForcedRLS(t *testing.T) {
	ctx := context.Background()
	rls := openRLSRole(t)
	users := userRepo.NewUserRepository(rls)

	// --- Demo user creation (pre-auth) in a transaction scoped to the new user.
	cfg := &config.Config{JWT: config.JWTConfig{
		Secret: "rls-role-test-secret-at-least-32-chars", Expiration: time.Minute,
		RefreshExpiration: time.Hour, Issuer: "t", Audience: "t",
	}}
	auth := authService.NewAuthService(users, accountRepo.NewAccountRepository(rls), categoryRepo.NewCategoryRepository(rls),
		budgetRepo.NewBudgetRepository(rls), transactionRepo.NewTransactionRepository(rls), cfg)
	auth.UseUserTransactions(func(ctx context.Context, userID string, fn func(ctx context.Context) error) error {
		return txhelper.WithUserTx(ctx, rls, userID, false, fn)
	})
	_, err := auth.CreateDemoUser(ctx, "")
	require.NoError(t, err)
	var demoID string
	require.NoError(t, testDB.QueryRow(`SELECT id FROM users WHERE is_demo AND ip_address = '' ORDER BY created_at DESC LIMIT 1`).Scan(&demoID))
	var seeded int
	require.NoError(t, testDB.QueryRow(`SELECT (SELECT count(*) FROM account WHERE user_id = $1) + (SELECT count(*) FROM categorys WHERE user_id = $1)
		+ (SELECT count(*) FROM transactions WHERE user_id = $1)`, demoID).Scan(&seeded))
	assert.Equal(t, 1+3+3, seeded, "account, categories and transactions of the demo user")

	// --- API key authentication (pre-auth lookup + last-used stamp).
	owner := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(testDB).Save(ctx, owner))
	keys := apikeyService.NewAPIKeyService(apikeyRepo.NewAPIKeyRepository(rls))
	var token string
	require.NoError(t, asUser(rls, owner.Id, func(ctx context.Context) error {
		k, err := keys.GenerateKey(ctx, owner.Id, "rls")
		if err == nil {
			token = k.Token
		}
		return err
	}))
	key, err := keys.ValidateKey(ctx, token)
	require.NoError(t, err)
	assert.Equal(t, owner.Id, key.UserID)
	var lastUsed *time.Time
	require.NoError(t, testDB.QueryRow(`SELECT last_used_at FROM user_api_keys WHERE id = $1`, key.ID).Scan(&lastUsed))
	assert.NotNil(t, lastUsed)
	// Inside another user's request the key stays invisible (no widening).
	stranger := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(testDB).Save(ctx, stranger))
	require.NoError(t, asUser(rls, stranger.Id, func(ctx context.Context) error {
		_, err := keys.ValidateKey(ctx, token)
		assert.Error(t, err)
		return nil
	}))

	// --- Passkey login lookups (pre-auth).
	pk := &passkey.Passkey{Id: newID(), UserId: owner.Id, CredentialId: []byte("cred-" + newID()), PublicKey: []byte{1, 2, 3},
		Name: "rls", CreatedAt: time.Now()}
	require.NoError(t, passkeyRepo.NewPasskeyRepository(testDB).Save(ctx, pk))
	passkeys := passkeyRepo.NewPasskeyRepository(rls)
	found, err := passkeys.FindByCredentialId(ctx, pk.CredentialId)
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, owner.Id, found.UserId)
	list, err := passkeys.FindByUserId(ctx, owner.Id)
	require.NoError(t, err)
	assert.Len(t, list, 1)
	require.NoError(t, passkeys.UpdateSignCount(ctx, pk.Id, 7, nil))
	require.NoError(t, asUser(rls, stranger.Id, func(ctx context.Context) error {
		leaked, err := passkeys.FindByUserId(ctx, owner.Id)
		require.NoError(t, err)
		assert.Empty(t, leaked, "another user's request cannot list the passkeys")
		return nil
	}))

	// --- Admin listing: users, and an admin request sees every user's rows.
	admin := userService.NewUserService(users)
	all, err := admin.GetAllUsers(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(all), 3)
	require.NoError(t, inRequestTx(ctx, rls, func(ctx context.Context) error {
		q := txhelper.FromContext(ctx, rls)
		require.NoError(t, txhelper.SetRLSContext(ctx, q, owner.Id, true))
		var accounts int
		require.NoError(t, q.QueryRowContext(ctx, `SELECT count(*) FROM account WHERE user_id = $1`, demoID).Scan(&accounts))
		assert.Equal(t, 1, accounts, "an admin request sees another user's account")
		return nil
	}))

	// --- Recurring scheduler: lists due rules across users (app.is_admin).
	scheduler := recurringService.NewRecurringTransactionService(recurringRepo.NewRecurringTransactionRepository(rls), nil, nil)
	require.NoError(t, scheduler.ProcessDueTransactions(ctx))

	// --- Demo cleanup worker: deletes the expired demo user and its rows.
	_, err = testDB.Exec(`UPDATE users SET created_at = now() - interval '48 hours' WHERE id = $1`, demoID)
	require.NoError(t, err)
	require.NoError(t, admin.DeleteDemoUsers(ctx, 24*time.Hour))
	var left int
	require.NoError(t, testDB.QueryRow(`SELECT (SELECT count(*) FROM users WHERE id = $1) + (SELECT count(*) FROM account WHERE user_id = $1)
		+ (SELECT count(*) FROM transactions WHERE user_id = $1)`, demoID).Scan(&left))
	assert.Zero(t, left, "the demo user and its rows are gone")
}

// No policy still relies on the '__admin__' user id sentinel (000039, 000064).
func TestRLSPolicies_UseIsAdmin(t *testing.T) {
	rows, err := testDB.Query(`SELECT tablename || '.' || policyname FROM pg_policies
		WHERE schemaname = 'public' AND (qual LIKE '%\_\_admin\_\_%' OR with_check LIKE '%\_\_admin\_\_%')`)
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	var stale []string
	for rows.Next() {
		var p string
		require.NoError(t, rows.Scan(&p))
		stale = append(stale, p)
	}
	require.NoError(t, rows.Err())
	assert.Empty(t, stale)
}
