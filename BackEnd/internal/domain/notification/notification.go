package notification

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type Notification struct {
	ID        uuid.UUID     `json:"id"`
	UserID    string        `json:"user_id"`
	Type      string        `json:"type"`
	Message   string        `json:"message"`
	Amount    *money.Amount `json:"amount,omitempty"`
	IsRead    bool          `json:"is_read"`
	CreatedAt time.Time     `json:"created_at"`
}

// HistoryCursor is the keyset position of the last notification of a page:
// the next page starts strictly after (CreatedAt, ID) in newest-first order.
type HistoryCursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
}

type NotificationRepository interface {
	Save(ctx context.Context, notification Notification) error
	// GetByUserID returns every notification of userID, newest first.
	GetByUserID(ctx context.Context, userID string) ([]Notification, error)
	// ListByUserID returns at most limit notifications of userID, newest
	// first (created_at DESC, id DESC), strictly after `after` when it is
	// non-nil.
	ListByUserID(ctx context.Context, userID string, after *HistoryCursor, limit int) ([]Notification, error)
	MarkAsRead(ctx context.Context, id string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	DeleteAll(ctx context.Context, userID string) error
}
