package notification

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestSendToUser_DoesNotCreateAStreamForUsersWithoutConnections(t *testing.T) {
	repo := &memRepo{}
	svc := NewNotificationService(repo)

	svc.SendToUser(context.Background(), "offline-user", `{"type":"info","message":"hi"}`)

	assert.Equal(t, 0, svc.ActiveStreams(), "publishing must not create a stream")
	assert.False(t, svc.GetServer().StreamExists("offline-user"))
	assert.Len(t, repo.items, 1, "the notification is still persisted")
	assert.False(t, svc.Publish("offline-user", "message", "x"), "publishing to a missing stream is a no-op")
}

func TestSubscribe_RemovesTheStreamWithItsLastSubscriber(t *testing.T) {
	svc := NewNotificationService(&memRepo{})

	release1 := svc.Subscribe("u1")
	release2 := svc.Subscribe("u1")
	assert.Equal(t, 1, svc.ActiveStreams())
	assert.True(t, svc.GetServer().StreamExists("u1"))

	release1()
	release1() // idempotent
	assert.True(t, svc.GetServer().StreamExists("u1"), "still one subscriber")

	release2()
	assert.False(t, svc.GetServer().StreamExists("u1"))
	assert.Equal(t, 0, svc.ActiveStreams())
}

func TestPublish_NeverBlocksOnAFullStream(t *testing.T) {
	svc := NewNotificationService(&memRepo{})
	release := svc.Subscribe("u1")
	defer release()

	done := make(chan struct{})
	go func() {
		// Nothing drains the stream: once its small buffer is full the
		// pushes are dropped instead of blocking the publisher.
		for range streamBufferSize * 10 {
			svc.Publish("u1", "message", "x")
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on a full stream")
	}
}
