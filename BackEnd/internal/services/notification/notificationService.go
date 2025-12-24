package notification

import (
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/domain/notification"
	"github.com/r3labs/sse/v2"
)

// NotificationService handles real-time user notifications via SSE (Server-Sent Events).
type NotificationService struct {
	server *sse.Server
	repo   notification.NotificationRepository
}

// NewNotificationService creates a new instance of NotificationService.
func NewNotificationService(repo notification.NotificationRepository) *NotificationService {
	server := sse.New()
	server.AutoReplay = false // We don't want to replay old notifications for now
	return &NotificationService{
		server: server,
		repo:   repo,
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
func (s *NotificationService) SendToUser(userID string, messageJSON string) {
	// 1. Persist to Database
	var notifPayload struct {
		Type    string   `json:"type"`
		Message string   `json:"message"`
		Amount  *float64 `json:"amount"`
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

	if err := s.repo.Save(notif); err != nil {
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

// GetHistory retrieves the notification history for a user.
func (s *NotificationService) GetHistory(userID string) ([]notification.Notification, error) {
	return s.repo.GetByUserID(userID)
}

// MarkAsRead marks a specific notification as read.
func (s *NotificationService) MarkAsRead(id string, userID string) error {
	return s.repo.MarkAsRead(id, userID)
}

// MarkAllAsRead marks all notifications for a user as read.
func (s *NotificationService) MarkAllAsRead(userID string) error {
	return s.repo.MarkAllAsRead(userID)
}

// DeleteAll removes all notifications for a user.
func (s *NotificationService) DeleteAll(userID string) error {
	return s.repo.DeleteAll(userID)
}
