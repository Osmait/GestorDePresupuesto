package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/server/routes"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
)

type Server struct {
	httpAddr       string
	Engine         *gin.Engine
	servicesAccunt account.AccountService

	shutdownTimeout time.Duration
}

func New(ctx context.Context, host string, port uint, shutdownTimeout time.Duration, servicesAccount account.AccountService) (context.Context, Server) {
	srv := Server{
		Engine:          gin.New(),
		httpAddr:        fmt.Sprintf("%s:%d", host, port),
		servicesAccunt:  servicesAccount,
		shutdownTimeout: shutdownTimeout,
	}
	srv.registerRoutes()
	return serverContext(ctx), srv
}
func (s *Server) registerRoutes() {
	routes.HealthRoutes(s.Engine)
	routes.AccountRotes(s.Engine, s.servicesAccunt)

}
func (s *Server) Run(ctx context.Context) error {
	log.Println("Server running on", s.httpAddr)

	srv := &http.Server{
		Addr:    s.httpAddr,
		Handler: s.Engine,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("server shut down", err)
		}
	}()

	<-ctx.Done()
	ctxShutDown, cancel := context.WithTimeout(context.Background(), s.shutdownTimeout)
	defer cancel()

	return srv.Shutdown(ctxShutDown)
}

func serverContext(ctx context.Context) context.Context {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	ctx, cancel := context.WithCancel(ctx)
	go func() {
		<-c
		cancel()

	}()

	return ctx
}
