package notification

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/asyncctx"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/r3labs/sse/v2"
)

const (
	// DefaultHistoryLimit is the page size of GET /notifications/history
	// when only a cursor is given.
	DefaultHistoryLimit = 50
	// MaxHistoryLimit is the largest accepted page size.
	MaxHistoryLimit = 100

	// asyncSendTimeout bounds one asynchronous notification (DB insert + SSE push).
	asyncSendTimeout = 10 * time.Second
	// maxAsyncSends bounds concurrently running asynchronous notifications;
	// beyond it new ones are dropped (and logged) instead of piling up
	// goroutines and pooled connections under a burst.
	maxAsyncSends = 64
)

// ErrInvalidCursor is returned for a history cursor this server did not issue.
var ErrInvalidCursor = errors.New("invalid notification cursor")

// HistoryPage is one page of the notification history, newest first.
// NextCursor is nil on the last page.
type HistoryPage struct {
	Items      []notification.Notification `json:"items"`
	NextCursor *string                     `json:"next_cursor"`
}

// NotificationService handles real-time user notifications via SSE (Server-Sent Events).
type NotificationService struct {
	server *sse.Server
	repo   notification.NotificationRepository

	asyncSlots chan struct{}
	asyncWG    sync.WaitGroup
}

// NewNotificationService creates a new instance of NotificationService.
func NewNotificationService(repo notification.NotificationRepository) *NotificationService {
	server := sse.New()
	server.AutoReplay = false // We don't want to replay old notifications for now
	return &NotificationService{
		server:     server,
		repo:       repo,
		asyncSlots: make(chan struct{}, maxAsyncSends),
	}
}

// GetServer returns the underlying SSE server instance.
func (s *NotificationService) GetServer() *sse.Server {
	return s.server
}

// CreateStream initializes a new notification stream for a client ID.
func (s *NotificationService) CreateStream(id string) {
	s.server.CreateStream(id)
}

// Publish sends a generic event to a specific stream.
func (s *NotificationService) Publish(streamID string, event string, data string) {
	s.server.Publish(streamID, &sse.Event{
		Event: []byte(event),
		Data:  []byte(data),
	})
}

// SendToUser sends a notification to a specific user's stream and persists it to the database.
// It handles JSON parsing of the message and ensures a valid notification structure.
func (s *NotificationService) SendToUser(ctx context.Context, userID string, messageJSON string) {
	// 1. Persist to Database
	var notifPayload struct {
		Type    string        `json:"type"`
		Message string        `json:"message"`
		Amount  *money.Amount `json:"amount"`
	}

	// Try to parse the JSON message
	err := json.Unmarshal([]byte(messageJSON), &notifPayload)

	// Create domain entity
	notif := notification.Notification{
		ID:        uuid.New(),
		UserID:    userID,
		CreatedAt: time.Now(),
		IsRead:    false,
	}

	if err == nil && notifPayload.Message != "" {
		// Valid JSON structure
		notif.Type = notifPayload.Type
		notif.Message = notifPayload.Message
		notif.Amount = notifPayload.Amount
	} else {
		// Fallback for raw string or invalid JSON
		notif.Type = "info"
		notif.Message = messageJSON
	}

	if err := s.repo.Save(ctx, notif); err != nil {
		log.Printf("Error saving notification to DB: %v", err)
		// We continue to send SSE even if DB fails
	} else {
		log.Printf("Notification saved to DB: %s", notif.ID)
	}

	// 2. Send via SSE
	if !s.server.StreamExists(userID) {
		s.server.CreateStream(userID)
	}
	s.server.Publish(userID, &sse.Event{
		Event: []byte("message"),
		Data:  []byte(messageJSON),
	})
}

// SendToUserAsync is SendToUser without blocking the caller, for
// notifications triggered from request handling (budget alerts).
//
//   - It only fires once the request transaction carried by ctx has
//     committed (txhelper.AfterCommit): a rolled-back request announces
//     nothing. Without a request transaction it is scheduled immediately.
//   - The goroutine never sees ctx itself: it runs on asyncctx.Detach(ctx)
//     (trace span, request id and locale copied; no cancellation, no request
//     transaction, no *gin.Context) bounded by asyncSendTimeout, and persists
//     through its own short RLS-scoped transaction.
//   - At most maxAsyncSends run at once; beyond that the notification is
//     dropped and logged.
func (s *NotificationService) SendToUserAsync(ctx context.Context, userID string, messageJSON string) {
	if s == nil {
		return
	}
	detached := asyncctx.Detach(ctx)
	txhelper.AfterCommit(ctx, func() {
		select {
		case s.asyncSlots <- struct{}{}:
		default:
			log.Printf("notification dropped: %d asynchronous notifications already in flight", maxAsyncSends)
			return
		}
		s.asyncWG.Add(1)
		go func() {
			defer func() {
				<-s.asyncSlots
				s.asyncWG.Done()
			}()
			sendCtx, cancel := context.WithTimeout(detached, asyncSendTimeout)
			defer cancel()
			s.SendToUser(sendCtx, userID, messageJSON)
		}()
	})
}

// Wait blocks until every asynchronous notification started so far has
// finished (tests, graceful shutdown).
func (s *NotificationService) Wait() {
	if s != nil {
		s.asyncWG.Wait()
	}
}

// GetHistory retrieves the whole notification history for a user, newest
// first (legacy, unpaginated GET /notifications/history).
func (s *NotificationService) GetHistory(ctx context.Context, userID string) ([]notification.Notification, error) {
	return s.repo.GetByUserID(ctx, userID)
}

// GetHistoryPage returns up to limit notifications (1..MaxHistoryLimit),
// newest first, starting after cursor ("" = first page).
func (s *NotificationService) GetHistoryPage(ctx context.Context, userID string, limit int, cursor string) (HistoryPage, error) {
	if limit < 1 || limit > MaxHistoryLimit {
		limit = DefaultHistoryLimit
	}
	var after *notification.HistoryCursor
	if cursor != "" {
		c, err := DecodeHistoryCursor(cursor)
		if err != nil {
			return HistoryPage{}, err
		}
		after = &c
	}
	// One extra row tells whether another page exists, so the last page
	// returns next_cursor: null instead of pointing at an empty page.
	items, err := s.repo.ListByUserID(ctx, userID, after, limit+1)
	if err != nil {
		return HistoryPage{}, err
	}
	page := HistoryPage{Items: items}
	if len(items) > limit {
		page.Items = items[:limit]
		last := page.Items[limit-1]
		next := EncodeHistoryCursor(notification.HistoryCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		page.NextCursor = &next
	}
	if page.Items == nil {
		page.Items = []notification.Notification{}
	}
	return page, nil
}

const cursorVersion = "v1"

// EncodeHistoryCursor returns the opaque cursor for c: base64url of
// "v1:<created_at unix microseconds>:<uuid>" (PostgreSQL timestamps have
// microsecond precision, so the position round-trips exactly).
func EncodeHistoryCursor(c notification.HistoryCursor) string {
	raw := cursorVersion + ":" + strconv.FormatInt(c.CreatedAt.UnixMicro(), 10) + ":" + c.ID.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// DecodeHistoryCursor parses a cursor produced by EncodeHistoryCursor.
func DecodeHistoryCursor(s string) (notification.HistoryCursor, error) {
	if len(s) > 128 {
		return notification.HistoryCursor{}, ErrInvalidCursor
	}
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return notification.HistoryCursor{}, ErrInvalidCursor
	}
	parts := strings.Split(string(raw), ":")
	if len(parts) != 3 || parts[0] != cursorVersion {
		return notification.HistoryCursor{}, ErrInvalidCursor
	}
	micros, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return notification.HistoryCursor{}, ErrInvalidCursor
	}
	id, err := uuid.Parse(parts[2])
	if err != nil {
		return notification.HistoryCursor{}, ErrInvalidCursor
	}
	return notification.HistoryCursor{CreatedAt: time.UnixMicro(micros).UTC(), ID: id}, nil
}

// MarkAsRead marks a specific notification as read.
func (s *NotificationService) MarkAsRead(ctx context.Context, id string, userID string) error {
	return s.repo.MarkAsRead(ctx, id, userID)
}

// MarkAllAsRead marks all notifications for a user as read.
func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllAsRead(ctx, userID)
}

// DeleteAll removes all notifications for a user.
func (s *NotificationService) DeleteAll(ctx context.Context, userID string) error {
	return s.repo.DeleteAll(ctx, userID)
}
