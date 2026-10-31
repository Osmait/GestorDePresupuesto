package ai

import (
	"context"
	"database/sql"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

type Handler struct {
	aiService             *aiService.Service
	categoryRepository    categoryRepo.CategoryRepoInterface
	transactionRepository transactionRepo.TransactionRepositoryInterface
	transactionService    *transactionService.TransactionService
	db                    *sql.DB
	aiCache               *aiService.AICacheService
	flags                 *middleware.FeatureFlags
}

// location is the app time zone (from the transaction service).
func (h *Handler) location() *time.Location {
	return h.transactionService.Location()
}

func NewHandler(
	aiService *aiService.Service,
	categoryRepo categoryRepo.CategoryRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	transactionService *transactionService.TransactionService,
	db *sql.DB,
	aiCache *aiService.AICacheService,
	flags *middleware.FeatureFlags,
) *Handler {
	return &Handler{
		aiService:             aiService,
		categoryRepository:    categoryRepo,
		transactionRepository: transactionRepo,
		transactionService:    transactionService,
		db:                    db,
		aiCache:               aiCache,
		flags:                 flags,
	}
}

// q returns the request's RLS transaction (or the pool outside a request).
// Most AI routes run after RLSMiddleware, which already holds the request's
// pooled connection: querying h.db directly would need a second connection
// and deadlock the pool under load.
func (h *Handler) q(ctx context.Context) txhelper.Querier {
	return txhelper.FromContext(ctx, h.db)
}

// inTx runs fn in a short transaction scoped to the request's user. The
// routes that call the AI provider are registered before RLSMiddleware so
// they hold no connection while the provider works: they do their reads and
// writes through inTx, never around the provider call. Under RLSMiddleware
// (or in tests that wrap the route with it) fn runs on the request
// transaction.
func (h *Handler) inTx(c *gin.Context, fn func(ctx context.Context) error) error {
	return txhelper.WithUserTx(c.Request.Context(), h.db, c.GetString("X-User-Id"), middleware.IsAdminRequest(c), fn)
}
