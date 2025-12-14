package notification

import (
	"github.com/r3labs/sse/v2"
)

type NotificationService struct {
	server *sse.Server
}

func NewNotificationService() *NotificationService {
	server := sse.New()
	server.AutoReplay = false // We don't want to replay old notifications for now
	return &NotificationService{
		server: server,
	}
}

func (s *NotificationService) GetServer() *sse.Server {
	return s.server
}

func (s *NotificationService) CreateStream(id string) {
	s.server.CreateStream(id)
}

func (s *NotificationService) Publish(streamID string, event string, data string) {
	s.server.Publish(streamID, &sse.Event{
		Event: []byte(event),
		Data:  []byte(data),
	})
}

// SendToUser sends a notification to a specific user's stream
func (s *NotificationService) SendToUser(userID string, message string) {
	// We assume each user subscribes to a stream named after their UserID
	// Ensure the stream exists (idempotent usually, or we create it lazily)
	if !s.server.StreamExists(userID) {
		s.server.CreateStream(userID)
	}
	s.server.Publish(userID, &sse.Event{
		Event: []byte("message"),
		Data:  []byte(message),
	})
}
