package notification

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/rs/zerolog/log"
)

// DefaultHeartbeatInterval is how often an idle SSE stream gets a `:ping`
// comment. It keeps proxies (the Next.js backend proxy, nginx, load balancers)
// from treating the connection as dead and lets clients notice a broken link.
const DefaultHeartbeatInterval = 20 * time.Second

type NotificationHandler struct {
	service           *notification.NotificationService
	heartbeatInterval time.Duration
}

func NewNotificationHandler(service *notification.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		service:           service,
		heartbeatInterval: DefaultHeartbeatInterval,
	}
}

// SetHeartbeatInterval overrides the SSE heartbeat period (non-positive values are ignored).
func (h *NotificationHandler) SetHeartbeatInterval(d time.Duration) {
	if d > 0 {
		h.heartbeatInterval = d
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
		log.Ctx(ctx.Request.Context()).Warn().Msg("notification subscribe without a user id")
		ctx.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	userIDStr := userID.(string)

	// SSE is long-lived: exempt this connection from the server-wide
	// ReadTimeout/WriteTimeout, otherwise the stream is cut after a minute or two.
	middleware.ClearConnDeadlines(ctx.Writer)

	// Register this connection: the user's stream exists while at least one
	// of their connections is open and is removed with the last one.
	release := h.service.Subscribe(userIDStr)
	defer release()

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

	// The SSE library only writes the status line on subscribe and then stays
	// silent until an event is published. Proxies that do not forward headers
	// until the first body byte (Next.js/undici) would then hold the response
	// for minutes. heartbeatWriter sends `: connected` right away and a `:ping`
	// comment periodically.
	hw := newHeartbeatWriter(ctx.Writer)
	stop := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		hw.run(h.heartbeatInterval, stop, ctx.Request.Context().Done())
	}()

	h.service.GetServer().ServeHTTP(hw, ctx.Request)

	close(stop)
	<-done
	hw.close()
}

func (h *NotificationHandler) SendTestNotification(ctx *gin.Context) {
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := userID.(string)

	message := `{"type": "test", "message": "This is a test notification 🚀"}`
	h.service.SendToUser(ctx.Request.Context(), userIDStr, message)

	ctx.JSON(http.StatusOK, gin.H{"message": "Notification sent"})
}

// GetHistory serves GET /notifications/history.
//
// Without query parameters it keeps the legacy response: a JSON array with
// the whole history, newest first (null when empty).
//
// With `limit` and/or `cursor` it returns one page, newest first
// (created_at DESC, id DESC):
//
//	GET /notifications/history?limit=<1..100, default 50>&cursor=<opaque>
//	200 {"items": [Notification...], "next_cursor": "<opaque>" | null}
//
// next_cursor is null on the last page; pass it back verbatim as `cursor` to
// get the next one. An out-of-range or non-numeric limit, or a cursor this
// server did not issue, is a 400.
func (h *NotificationHandler) GetHistory(ctx *gin.Context) {
	userID, exists := ctx.Get("X-User-Id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := userID.(string)

	limitParam, hasLimit := ctx.GetQuery("limit")
	cursor, hasCursor := ctx.GetQuery("cursor")
	if !hasLimit && !hasCursor {
		history, err := h.service.GetHistory(ctx.Request.Context(), userIDStr)
		if err != nil {
			log.Ctx(ctx.Request.Context()).Error().Err(err).Msg("failed to get notification history")
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, history)
		return
	}

	limit := notification.DefaultHistoryLimit
	if limitParam != "" {
		n, err := strconv.Atoi(limitParam)
		if err != nil || n < 1 || n > notification.MaxHistoryLimit {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("limit must be an integer between 1 and %d", notification.MaxHistoryLimit)})
			return
		}
		limit = n
	}

	page, err := h.service.GetHistoryPage(ctx.Request.Context(), userIDStr, limit, cursor)
	if errors.Is(err, notification.ErrInvalidCursor) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid cursor"})
		return
	}
	if err != nil {
		log.Ctx(ctx.Request.Context()).Error().Err(err).Msg("failed to get notification history")
		_ = ctx.Error(err)
		return
	}
	ctx.JSON(http.StatusOK, page)
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

	if err := h.service.MarkAsRead(ctx.Request.Context(), notificationID, userIDStr); err != nil {
		log.Ctx(ctx.Request.Context()).Error().Err(err).Msg("failed to mark notification as read")
		_ = ctx.Error(err)
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

	if err := h.service.MarkAllAsRead(ctx.Request.Context(), userIDStr); err != nil {
		log.Ctx(ctx.Request.Context()).Error().Err(err).Msg("failed to mark all notifications as read")
		_ = ctx.Error(err)
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

	if err := h.service.DeleteAll(ctx.Request.Context(), userIDStr); err != nil {
		log.Ctx(ctx.Request.Context()).Error().Err(err).Msg("failed to delete notifications")
		_ = ctx.Error(err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "All notifications deleted"})
}
