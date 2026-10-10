package middleware

import (
	"bytes"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestBufferedResponseWriter_ReleaseResetsAndCapsBuffer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	small := newBufferedResponseWriter(c.Writer)
	_, _ = small.Write([]byte(`{"ok":true}`))
	small.WriteHeader(201)
	smallCap := small.buf.Cap()
	releaseBufferedResponseWriter(small)
	assert.Nil(t, small.ResponseWriter)
	assert.Zero(t, small.buf.Len())
	assert.Equal(t, smallCap, small.buf.Cap(), "small buffers keep their capacity for reuse")
	assert.False(t, small.wroteHeader || small.streaming)
	assert.Zero(t, small.status)

	big := newBufferedResponseWriter(c.Writer)
	_, _ = big.Write(bytes.Repeat([]byte("x"), 4*maxPooledResponseBuffer))
	releaseBufferedResponseWriter(big)
	assert.LessOrEqual(t, big.buf.Cap(), maxPooledResponseBuffer, "huge buffers are not kept in the pool")

	reused := newBufferedResponseWriter(c.Writer)
	assert.Equal(t, c.Writer.Status(), reused.Status())
	assert.Zero(t, reused.buf.Len())
	releaseBufferedResponseWriter(reused)
}
