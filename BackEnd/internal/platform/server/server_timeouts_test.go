package server

import (
	"net/http"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/stretchr/testify/assert"
)

func TestNewHTTPServer_Timeouts(t *testing.T) {
	tests := []struct {
		name string
		cfg  config.ServerConfig
		want [4]time.Duration // readHeader, read, write, idle
	}{
		{
			name: "zero config falls back to safe defaults",
			cfg:  config.ServerConfig{},
			want: [4]time.Duration{defaultReadHeaderTimeout, defaultReadTimeout, defaultWriteTimeout, defaultIdleTimeout},
		},
		{
			name: "configured values are used",
			cfg: config.ServerConfig{
				ReadHeaderTimeout: 2 * time.Second,
				ReadTimeout:       20 * time.Second,
				WriteTimeout:      40 * time.Second,
				IdleTimeout:       90 * time.Second,
				MaxHeaderBytes:    4096,
			},
			want: [4]time.Duration{2 * time.Second, 20 * time.Second, 40 * time.Second, 90 * time.Second},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			srv := NewHTTPServer(":0", http.NotFoundHandler(), tc.cfg)
			assert.Equal(t, tc.want[0], srv.ReadHeaderTimeout)
			assert.Equal(t, tc.want[1], srv.ReadTimeout)
			assert.Equal(t, tc.want[2], srv.WriteTimeout)
			assert.Equal(t, tc.want[3], srv.IdleTimeout)
			if tc.cfg.MaxHeaderBytes > 0 {
				assert.Equal(t, tc.cfg.MaxHeaderBytes, srv.MaxHeaderBytes)
			}
		})
	}
}
