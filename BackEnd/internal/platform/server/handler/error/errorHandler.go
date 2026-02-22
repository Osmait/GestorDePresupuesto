package errorHandler

import (
	"context"
	"errors"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

func ResponseByTypeOfErr(err error, ctx *gin.Context) {
	if err == nil {
		return
	}

	if _, ok := apperrors.AsAppError(err); ok {
		_ = ctx.Error(err)
		return
	}

	operation := ctx.Request.Method + " " + ctx.FullPath()
	switch {
	case errorhttp.IsErrNotDuplicate(err):
		_ = ctx.Error(apperrors.NewConflictError("resource", err.Error()).WithCause(err).WithContext(ctx.Request.Context()).WithOperation(operation))
		return
	case errorhttp.IsErrNotBadRequest(err):
		_ = ctx.Error(apperrors.NewValidationError("BAD_REQUEST", err.Error()).WithCause(err).WithContext(ctx.Request.Context()).WithOperation(operation))
		return
	case errorhttp.IsErrNotFound(err):
		_ = ctx.Error(apperrors.NewNotFoundError("resource", err.Error()).WithCause(err).WithContext(ctx.Request.Context()).WithOperation(operation))
		return

	default:
		wrapped := apperrors.NewInternalError("internal server error", err).WithContext(ctx.Request.Context()).WithOperation(operation)
		if errors.Is(err, context.Canceled) {
			wrapped = apperrors.NewInternalError("request cancelled", err).WithContext(ctx.Request.Context()).WithOperation(operation)
		}
		_ = ctx.Error(wrapped)
		return

	}
}
