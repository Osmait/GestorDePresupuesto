package notification

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/osmait/gestorDePresupuesto/internal/domain/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

type NotificationRepository struct {
	db *sql.DB
}

func NewNotificationRepository(db *sql.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

const insertNotification = `INSERT INTO notifications (id, user_id, type, message, amount, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`

// Save inserts n. Inside a request it runs on the request transaction. Without
// one (asynchronous alerts, the recurring scheduler) it opens a short
// transaction scoped to n.UserID: notifications has FORCE ROW LEVEL SECURITY,
// so an insert on a bare pooled connection — where app.current_user_id is
// unset — is rejected for any role that does not bypass RLS.
func (r *NotificationRepository) Save(ctx context.Context, n notification.Notification) error {
	ownTx := txhelper.FromContext(ctx, r.db) == txhelper.Querier(r.db)
	err := txhelper.InTx(ctx, r.db, func(q txhelper.Querier) error {
		if ownTx {
			if _, err := q.ExecContext(ctx,
				`SELECT set_config('app.current_user_id', $1, true), set_config('app.is_admin', 'false', true)`,
				n.UserID); err != nil {
				return err
			}
		}
		_, err := q.ExecContext(ctx, insertNotification, n.ID, n.UserID, n.Type, n.Message, n.Amount, n.IsRead, n.CreatedAt)
		return err
	})
	if err != nil {
		return fmt.Errorf("error saving notification: %w", err)
	}
	return nil
}

const selectNotifications = `SELECT id, user_id, type, message, amount, is_read, created_at FROM notifications`

// GetByUserID returns every notification of userID, newest first.
func (r *NotificationRepository) GetByUserID(ctx context.Context, userID string) ([]notification.Notification, error) {
	query := selectNotifications + ` WHERE user_id = $1 ORDER BY created_at DESC, id DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("error querying notifications: %w", err)
	}
	return scanNotifications(rows, 0)
}

// ListByUserID returns one keyset page (idx_notifications_user_created_id):
// at most limit notifications of userID, newest first, strictly after
// `after` when it is non-nil.
func (r *NotificationRepository) ListByUserID(ctx context.Context, userID string, after *notification.HistoryCursor, limit int) ([]notification.Notification, error) {
	var (
		rows *sql.Rows
		err  error
		q    = txhelper.FromContext(ctx, r.db)
	)
	if after == nil {
		rows, err = q.QueryContext(ctx, selectNotifications+
			` WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`, userID, limit)
	} else {
		rows, err = q.QueryContext(ctx, selectNotifications+
			` WHERE user_id = $1 AND (created_at, id) < ($2, $3) ORDER BY created_at DESC, id DESC LIMIT $4`,
			userID, after.CreatedAt, after.ID, limit)
	}
	if err != nil {
		return nil, fmt.Errorf("error querying notifications: %w", err)
	}
	items, err := scanNotifications(rows, limit)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []notification.Notification{}
	}
	return items, nil
}

func scanNotifications(rows *sql.Rows, sizeHint int) ([]notification.Notification, error) {
	defer func() { _ = rows.Close() }()
	var notifications []notification.Notification
	if sizeHint > 0 {
		notifications = make([]notification.Notification, 0, sizeHint)
	}
	for rows.Next() {
		var n notification.Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Message, &n.Amount, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("error scanning notification: %w", err)
		}
		notifications = append(notifications, n)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error reading notifications: %w", err)
	}
	return notifications, nil
}

func (r *NotificationRepository) MarkAsRead(ctx context.Context, id string, userID string) error {
	query := `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("error marking notification as read: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}
	if rows == 0 {
		// Missing, or owned by another user: indistinguishable on purpose.
		return ownership.ErrNotFound
	}

	return nil
}

func (r *NotificationRepository) MarkAllAsRead(ctx context.Context, userID string) error {
	query := `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("error marking all notifications as read: %w", err)
	}
	return nil
}

func (r *NotificationRepository) DeleteAll(ctx context.Context, userID string) error {
	query := `DELETE FROM notifications WHERE user_id = $1`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("error deleting all notifications: %w", err)
	}
	return nil
}
