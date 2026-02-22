package notification

import (
	"net/http"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/rs/zerolog/log"
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
	userIDStr, ok := getUserID(ctx, "NotificationHandler.Subscribe")
	if !ok {
		return
	}

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
	userIDStr, ok := getUserID(ctx, "NotificationHandler.SendTestNotification")
	if !ok {
		return
	}

	message := `{"type": "test", "message": "This is a test notification 🚀"}`
	h.service.SendToUser(userIDStr, message)

	ctx.JSON(http.StatusOK, gin.H{"message": "Notification sent"})
}

func (h *NotificationHandler) GetHistory(ctx *gin.Context) {
	userIDStr, ok := getUserID(ctx, "NotificationHandler.GetHistory")
	if !ok {
		return
	}

	history, err := h.service.GetHistory(userIDStr)
	if err != nil {
		log.Error().Err(err).Str("user_id", userIDStr).Str("operation", "GetHistory").Msg("failed to get notification history")
		_ = ctx.Error(apperrors.NewInternalError("failed to load notification history", err).WithContext(ctx.Request.Context()).WithOperation("NotificationHandler.GetHistory"))
		return
	}

	ctx.JSON(http.StatusOK, history)
}

func (h *NotificationHandler) MarkAsRead(ctx *gin.Context) {
	userIDStr, ok := getUserID(ctx, "NotificationHandler.MarkAsRead")
	if !ok {
		return
	}

	notificationID := ctx.Param("id")
	if notificationID == "" {
		_ = ctx.Error(apperrors.NewValidationError("NOTIFICATION_ID_REQUIRED", "notification ID is required").WithContext(ctx.Request.Context()).WithOperation("NotificationHandler.MarkAsRead"))
		return
	}

	if err := h.service.MarkAsRead(notificationID, userIDStr); err != nil {
		log.Error().Err(err).Str("user_id", userIDStr).Str("notification_id", notificationID).Str("operation", "MarkAsRead").Msg("failed to mark notification as read")
		_ = ctx.Error(apperrors.NewInternalError("failed to mark notification as read", err).WithContext(ctx.Request.Context()).WithOperation("NotificationHandler.MarkAsRead"))
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(ctx *gin.Context) {
	userIDStr, ok := getUserID(ctx, "NotificationHandler.MarkAllAsRead")
	if !ok {
		return
	}

	if err := h.service.MarkAllAsRead(userIDStr); err != nil {
		log.Error().Err(err).Str("user_id", userIDStr).Str("operation", "MarkAllAsRead").Msg("failed to mark all notifications as read")
		_ = ctx.Error(apperrors.NewInternalError("failed to mark all notifications as read", err).WithContext(ctx.Request.Context()).WithOperation("NotificationHandler.MarkAllAsRead"))
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

func (h *NotificationHandler) DeleteAll(ctx *gin.Context) {
	userIDStr, ok := getUserID(ctx, "NotificationHandler.DeleteAll")
	if !ok {
		return
	}

	if err := h.service.DeleteAll(userIDStr); err != nil {
		log.Error().Err(err).Str("user_id", userIDStr).Str("operation", "DeleteAll").Msg("failed to delete all notifications")
		_ = ctx.Error(apperrors.NewInternalError("failed to delete notifications", err).WithContext(ctx.Request.Context()).WithOperation("NotificationHandler.DeleteAll"))
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "All notifications deleted"})
}

func getUserID(ctx *gin.Context, operation string) (string, bool) {
	userID := ctx.GetString("X-User-Id")
	if userID == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized").WithContext(ctx.Request.Context()).WithOperation(operation))
		return "", false
	}
	return userID, true
}
