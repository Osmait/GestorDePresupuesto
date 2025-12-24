package notification

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/osmait/gestorDePresupuesto/internal/domain/notification"
)

type NotificationRepository struct {
	db *sql.DB
}

func NewNotificationRepository(db *sql.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) Save(n notification.Notification) error {
	query := `INSERT INTO notifications (id, user_id, type, message, amount, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.Exec(query, n.ID, n.UserID, n.Type, n.Message, n.Amount, n.IsRead, n.CreatedAt)
	if err != nil {
		log.Printf("Error saving notification: %v", err)
		return fmt.Errorf("error saving notification: %w", err)
	}
	return nil
}

func (r *NotificationRepository) GetByUserID(userID string) ([]notification.Notification, error) {
	query := `SELECT id, user_id, type, message, amount, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("error querying notifications: %w", err)
	}
	defer rows.Close()

	var notifications []notification.Notification
	for rows.Next() {
		var n notification.Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Message, &n.Amount, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("error scanning notification: %w", err)
		}
		notifications = append(notifications, n)
	}
	return notifications, nil
}

func (r *NotificationRepository) MarkAsRead(id string, userID string) error {
	query := `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(query, id, userID)
	if err != nil {
		return fmt.Errorf("error marking notification as read: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("notification not found or already read")
	}

	return nil
}

func (r *NotificationRepository) MarkAllAsRead(userID string) error {
	query := `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`
	_, err := r.db.Exec(query, userID)
	if err != nil {
		return fmt.Errorf("error marking all notifications as read: %w", err)
	}
	return nil
}

func (r *NotificationRepository) DeleteAll(userID string) error {
	query := `DELETE FROM notifications WHERE user_id = $1`
	_, err := r.db.Exec(query, userID)
	if err != nil {
		return fmt.Errorf("error deleting all notifications: %w", err)
	}
	return nil
}
