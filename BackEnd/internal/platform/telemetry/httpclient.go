package telemetry

import (
	"net/http"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/propagation"
)

// NewHTTPClient returns an *http.Client for calls to third-party APIs: it has
// a hard timeout and an otelhttp transport that records a client span and the
// http.client.request.duration metric (labelled by method, host and status).
//
// The transport uses the global providers, so it is a no-op until Setup
// enables tracing/metrics. Trace context is deliberately NOT propagated to
// third parties (empty propagator): their servers are not ours.
func NewHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout:   timeout,
		Transport: NewTransport(http.DefaultTransport),
	}
}

// NewTransport wraps base with otelhttp (see NewHTTPClient).
func NewTransport(base http.RoundTripper) http.RoundTripper {
	return otelhttp.NewTransport(base,
		otelhttp.WithPropagators(propagation.NewCompositeTextMapPropagator()),
		otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
			// Host only: URLs carry symbols/query strings.
			return "HTTP " + r.Method + " " + r.URL.Host
		}),
	)
}
