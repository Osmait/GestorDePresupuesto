package notification

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
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
	"github.com/rs/zerolog/log"
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

	// streamBufferSize is the event queue of one user's stream. Events are
	// published with TryPublish: when a stream is this far behind, a live
	// push is dropped (it is persisted and shows up in the history) instead
	// of blocking the publisher.
	streamBufferSize = 16
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
//
// Stream lifecycle: a user's stream (a goroutine plus a small event queue)
// exists only while at least one of their SSE connections is open. Subscribe
// creates it and the release function it returns removes it with the last
// subscriber. Publishing to a user without a stream is a no-op: the
// notification is still persisted and shows up in the history.
type NotificationService struct {
	server *sse.Server
	repo   notification.NotificationRepository

	streamsMu sync.Mutex
	// subscribers counts the open connections of each user's stream.
	subscribers map[string]int

	asyncSlots chan struct{}
	asyncWG    sync.WaitGroup
}

// NewNotificationService creates a new instance of NotificationService.
func NewNotificationService(repo notification.NotificationRepository) *NotificationService {
	server := sse.New()
	server.AutoReplay = false // We don't want to replay old notifications for now
	server.AutoStream = false // streams are created by Subscribe only
	server.BufferSize = streamBufferSize
	return &NotificationService{
		server:      server,
		repo:        repo,
		subscribers: make(map[string]int),
		asyncSlots:  make(chan struct{}, maxAsyncSends),
	}
}

// GetServer returns the underlying SSE server instance.
func (s *NotificationService) GetServer() *sse.Server {
	return s.server
}

// Subscribe registers one SSE connection of userID, creating the user's
// stream if needed. The caller must call release once the connection has
// been served; the stream is removed with its last subscriber. The stream
// cannot disappear between Subscribe and release, so serving it never races
// its removal.
func (s *NotificationService) Subscribe(userID string) (release func()) {
	s.streamsMu.Lock()
	s.subscribers[userID]++
	if !s.server.StreamExists(userID) {
		s.server.CreateStream(userID)
	}
	s.streamsMu.Unlock()

	var once sync.Once
	return func() {
		once.Do(func() {
			s.streamsMu.Lock()
			defer s.streamsMu.Unlock()
			s.subscribers[userID]--
			if s.subscribers[userID] <= 0 {
				delete(s.subscribers, userID)
				s.server.RemoveStream(userID)
			}
		})
	}
}

// ActiveStreams reports how many user streams exist (tests, diagnostics).
func (s *NotificationService) ActiveStreams() int {
	s.streamsMu.Lock()
	defer s.streamsMu.Unlock()
	return len(s.subscribers)
}

// Publish sends an event to a user's stream. It never blocks and never
// creates a stream: without an open connection, or when the stream is too
// far behind, the live push is dropped and false is returned.
func (s *NotificationService) Publish(streamID string, event string, data string) bool {
	return s.server.TryPublish(streamID, &sse.Event{
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
		// We continue to send SSE even if DB fails
		log.Ctx(ctx).Error().Err(err).Str("user_id", userID).Msg("failed to save notification")
	} else {
		log.Ctx(ctx).Debug().Str("notification_id", notif.ID.String()).Msg("notification saved")
	}

	// 2. Send via SSE (a no-op when the user has no open stream)
	s.Publish(userID, "message", messageJSON)
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
			log.Ctx(detached).Warn().Int("in_flight", maxAsyncSends).Msg("notification dropped: too many asynchronous notifications in flight")
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
