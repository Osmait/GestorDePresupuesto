package notification

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
)

type NotificationHandler struct {
	service *notification.NotificationService
}

func NewNotificationHandler(service *notification.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		service: service,
	}
}

func (h *NotificationHandler) Subscribe(ctx *gin.Context) {
	// The r3labs/sse library handles the HTTP connection hijacking and SSE headers
	// We just need to check authentication and pass the writer/req

	// Authentication is handled by Middleware, so if we are here, we have a UserID
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		// Log error but proceed? Or fail? The middleware should have handled it.
		// If using query param for auth (EventSource limitation), we might need to manually check here if middleware failed.
		// Assuming standard Bearer token via Polyfill on frontend.
		log.Println("NotificationHandler: User ID not found in context")
		ctx.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	userIDStr := userID.(string)

	// Ensure the stream for this user exists
	if !h.service.GetServer().StreamExists(userIDStr) {
		h.service.GetServer().CreateStream(userIDStr)
	}

	// Serve the stream
	// We need to rewrite the query param 'stream' to match our UserID if we want strict per-user streams
	// The library uses `?stream=stream_id` to know which stream to subscribe to.
	// We can forcibly set it or redirect.
	// Actually, `ServeHTTP` looks at URL params.
	// Let's manually invoke the server logic but overriding the stream ID?

	// Easier approach: The frontend sends `?stream={userID}`.
	// Make it more secure: WE set the stream to the UserID regardless of what they ask, or verify it matches.

	// r3labs/sse ServeHTTP does:
	// stream := r.URL.Query().Get("stream")
	// If stream is empty, it subscribes to all? Or default?

	// Strategy:
	// 1. Pass the underlying ResponseWriter and Request to the SSE server.
	// 2. Modify the Query params of the request *before* passing it, to enforce stream=userID

	q := ctx.Request.URL.Query()
	q.Set("stream", userIDStr)
	ctx.Request.URL.RawQuery = q.Encode()

	h.service.GetServer().ServeHTTP(ctx.Writer, ctx.Request)
}

func (h *NotificationHandler) SendTestNotification(ctx *gin.Context) {
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := userID.(string)

	message := `{"type": "test", "message": "This is a test notification 🚀"}`
	h.service.SendToUser(userIDStr, message)

	ctx.JSON(http.StatusOK, gin.H{"message": "Notification sent"})
}

func (h *NotificationHandler) GetHistory(ctx *gin.Context) {
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := userID.(string)

	history, err := h.service.GetHistory(userIDStr)
	if err != nil {
		log.Printf("Error getting notification history: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
		return
	}

	ctx.JSON(http.StatusOK, history)
}

func (h *NotificationHandler) MarkAsRead(ctx *gin.Context) {
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := userID.(string)

	notificationID := ctx.Param("id")
	if notificationID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Notification ID is required"})
		return
	}

	if err := h.service.MarkAsRead(notificationID, userIDStr); err != nil {
		log.Printf("Error marking notification as read: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(ctx *gin.Context) {
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := userID.(string)

	if err := h.service.MarkAllAsRead(userIDStr); err != nil {
		log.Printf("Error marking all notifications as read: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

func (h *NotificationHandler) DeleteAll(ctx *gin.Context) {
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := userID.(string)

	if err := h.service.DeleteAll(userIDStr); err != nil {
		log.Printf("Error deleting all notifications: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "All notifications deleted"})
}
