package notification

import (
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID        uuid.UUID `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	Amount    *float64  `json:"amount,omitempty"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type NotificationRepository interface {
	Save(notification Notification) error
	GetByUserID(userID string) ([]Notification, error)
	MarkAsRead(id string, userID string) error
	MarkAllAsRead(userID string) error
	DeleteAll(userID string) error
}
