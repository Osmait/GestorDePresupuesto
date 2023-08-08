package main

import (
	"log"

	"github.com/osmait/gestorDePresupuesto/src/cmd/api/boostrap"
)

func main() {
	if err := boostrap.Run(); err != nil {
		log.Fatal(err)

	}
}
