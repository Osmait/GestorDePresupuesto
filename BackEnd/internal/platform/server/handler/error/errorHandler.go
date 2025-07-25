package errorHandler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

func ReponseByTypeOfErr(err error, ctx *gin.Context) {
	switch {
	case errorhttp.IsErrNotDuplicate(err):
		errorResponse := errorhttp.NewErroApp(http.StatusConflict, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusConflict, errorResponse)
		return
	case errorhttp.IsErrNotBadRequest(err):
		errorResponse := errorhttp.NewErroApp(http.StatusBadRequest, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusBadRequest, errorResponse)
		return
	case errorhttp.IsErrNotFound(err):
		errorResponse := errorhttp.NewErroApp(http.StatusNotFound, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusNotFound, errorResponse)
		return

	default:
		errorResponse := errorhttp.NewErroApp(http.StatusInternalServerError, ctx.Request.URL.Path, err.Error(), time.Now())
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, errorResponse)
		return

	}
}
