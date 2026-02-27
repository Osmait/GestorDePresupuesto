package errorHandler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

func ResponseByTypeOfErr(err error, ctx *gin.Context) {
	switch {
	case errorhttp.IsErrNotDuplicate(err):
		errorResponse := errorhttp.NewErrorApp(http.StatusConflict, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusConflict, errorResponse)
		return
	case errorhttp.IsErrNotBadRequest(err):
		errorResponse := errorhttp.NewErrorApp(http.StatusBadRequest, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusBadRequest, errorResponse)
		return
	case errorhttp.IsErrNotFound(err):
		errorResponse := errorhttp.NewErrorApp(http.StatusNotFound, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusNotFound, errorResponse)
		return

	default:
		errorResponse := errorhttp.NewErrorApp(http.StatusInternalServerError, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, errorResponse)
		return

	}
}
