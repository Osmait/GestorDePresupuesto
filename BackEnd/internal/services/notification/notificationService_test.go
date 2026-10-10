package notification

import (
	"context"
	"database/sql"
	"encoding/base64"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/domain/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// memRepo is an in-memory NotificationRepository ordered like the SQL one.
type memRepo struct {
	mu       sync.Mutex
	items    []notification.Notification
	saved    []context.Context
	savedErr []error // ctx.Err() at the time of the call
}

func (r *memRepo) Save(ctx context.Context, n notification.Notification) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items = append(r.items, n)
	r.saved = append(r.saved, ctx)
	r.savedErr = append(r.savedErr, ctx.Err())
	return nil
}

func (r *memRepo) sorted(userID string) []notification.Notification {
	var out []notification.Notification
	for _, n := range r.items {
		if n.UserID == userID {
			out = append(out, n)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.After(out[j].CreatedAt)
		}
		return out[i].ID.String() > out[j].ID.String()
	})
	return out
}

func (r *memRepo) GetByUserID(_ context.Context, userID string) ([]notification.Notification, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.sorted(userID), nil
}

func (r *memRepo) ListByUserID(_ context.Context, userID string, after *notification.HistoryCursor, limit int) ([]notification.Notification, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []notification.Notification{}
	for _, n := range r.sorted(userID) {
		if after != nil {
			if n.CreatedAt.After(after.CreatedAt) ||
				(n.CreatedAt.Equal(after.CreatedAt) && n.ID.String() >= after.ID.String()) {
				continue
			}
		}
		if len(out) == limit {
			break
		}
		out = append(out, n)
	}
	return out, nil
}

func (r *memRepo) MarkAsRead(context.Context, string, string) error { return nil }
func (r *memRepo) MarkAllAsRead(context.Context, string) error      { return nil }
func (r *memRepo) DeleteAll(context.Context, string) error          { return nil }

func seed(r *memRepo, userID string, n int) {
	base := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)
	for i := range n {
		// Pairs share a timestamp so the id tie-break is exercised.
		r.items = append(r.items, notification.Notification{
			ID: uuid.New(), UserID: userID, Type: "info", Message: "m",
			CreatedAt: base.Add(time.Duration(i/2) * time.Second),
		})
	}
}

func TestGetHistoryPage_WalksEveryNotificationOnceNewestFirst(t *testing.T) {
	repo := &memRepo{}
	seed(repo, "u1", 7)
	seed(repo, "u2", 3)
	svc := NewNotificationService(repo)
	want, _ := repo.GetByUserID(context.Background(), "u1")

	var got []notification.Notification
	cursor := ""
	pages := 0
	for {
		page, err := svc.GetHistoryPage(context.Background(), "u1", 3, cursor)
		require.NoError(t, err)
		pages++
		got = append(got, page.Items...)
		if page.NextCursor == nil {
			break
		}
		cursor = *page.NextCursor
		require.Less(t, pages, 10)
	}
	assert.Equal(t, 3, pages) // 3 + 3 + 1
	assert.Equal(t, want, got)
}

func TestGetHistoryPage_ExactMultipleHasNoEmptyTrailingPage(t *testing.T) {
	repo := &memRepo{}
	seed(repo, "u1", 4)
	svc := NewNotificationService(repo)

	first, err := svc.GetHistoryPage(context.Background(), "u1", 2, "")
	require.NoError(t, err)
	require.NotNil(t, first.NextCursor)
	second, err := svc.GetHistoryPage(context.Background(), "u1", 2, *first.NextCursor)
	require.NoError(t, err)
	assert.Len(t, second.Items, 2)
	assert.Nil(t, second.NextCursor)
}

func TestGetHistoryPage_EmptyIsArrayAndDefaultLimit(t *testing.T) {
	repo := &memRepo{}
	svc := NewNotificationService(repo)
	page, err := svc.GetHistoryPage(context.Background(), "nobody", 0, "")
	require.NoError(t, err)
	assert.NotNil(t, page.Items)
	assert.Empty(t, page.Items)
	assert.Nil(t, page.NextCursor)

	seed(repo, "u1", DefaultHistoryLimit+5)
	page, err = svc.GetHistoryPage(context.Background(), "u1", 0, "")
	require.NoError(t, err)
	assert.Len(t, page.Items, DefaultHistoryLimit)
}

func TestHistoryCursor_RoundTripAndRejectsForeignInput(t *testing.T) {
	c := notification.HistoryCursor{CreatedAt: time.Date(2026, 1, 2, 3, 4, 5, 123456000, time.UTC), ID: uuid.New()}
	got, err := DecodeHistoryCursor(EncodeHistoryCursor(c))
	require.NoError(t, err)
	assert.True(t, c.CreatedAt.Equal(got.CreatedAt))
	assert.Equal(t, c.ID, got.ID)

	for _, bad := range []string{
		"not base64!",
		base64.RawURLEncoding.EncodeToString([]byte("v2:1:" + uuid.NewString())),
		base64.RawURLEncoding.EncodeToString([]byte("v1:abc:" + uuid.NewString())),
		base64.RawURLEncoding.EncodeToString([]byte("v1:1:not-a-uuid")),
		base64.RawURLEncoding.EncodeToString([]byte("v1:1")),
		string(make([]byte, 200)),
	} {
		_, err := DecodeHistoryCursor(bad)
		assert.ErrorIs(t, err, ErrInvalidCursor, bad)
	}
	_, err = NewNotificationService(&memRepo{}).GetHistoryPage(context.Background(), "u", 10, "garbage")
	assert.ErrorIs(t, err, ErrInvalidCursor)
}

func TestSendToUserAsync_OnlyAfterCommitAndOnDetachedContext(t *testing.T) {
	repo := &memRepo{}
	svc := NewNotificationService(repo)

	newRequestCtx := func() (context.Context, *txhelper.TxHooks, context.CancelFunc) {
		hooks := txhelper.NewTxHooks()
		ctx := txhelper.WithTxHooks(txhelper.WithTx(context.Background(), &sql.Tx{}), hooks)
		ctx, cancel := context.WithCancel(ctx)
		return ctx, hooks, cancel
	}

	// Rolled back: nothing is sent.
	ctx, hooks, cancel := newRequestCtx()
	svc.SendToUserAsync(ctx, "u1", `{"type":"budget_warning","message":"rolled back"}`)
	cancel()
	hooks.Run()
	svc.Wait()
	assert.Empty(t, repo.items)

	// Committed: sent once the hooks run, even though the request context
	// is already cancelled, and never with the request transaction.
	ctx, hooks, cancel = newRequestCtx()
	svc.SendToUserAsync(ctx, "u1", `{"type":"budget_warning","message":"committed","amount":12.5}`)
	assert.Empty(t, repo.items, "nothing may happen before the commit")
	cancel()
	hooks.MarkCommitted()
	hooks.Run()
	svc.Wait()

	require.Len(t, repo.items, 1)
	assert.Equal(t, "committed", repo.items[0].Message)
	assert.Equal(t, "12.5", repo.items[0].Amount.String())
	saveCtx := repo.saved[0]
	assert.NoError(t, repo.savedErr[0], "send context must not inherit the request cancellation")
	var db *sql.DB
	assert.Equal(t, txhelper.Querier(db), txhelper.FromContext(saveCtx, db), "request transaction leaked into async work")
	_, hasDeadline := saveCtx.Deadline()
	assert.True(t, hasDeadline, "async send must be bounded")

	// Without a request transaction it is scheduled immediately.
	svc.SendToUserAsync(context.Background(), "u1", `{"type":"info","message":"background"}`)
	svc.Wait()
	assert.Len(t, repo.items, 2)

	var nilSvc *NotificationService
	nilSvc.SendToUserAsync(context.Background(), "u1", "{}") // no panic
}
