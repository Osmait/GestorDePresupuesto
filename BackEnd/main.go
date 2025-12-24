package main

import (
	"log"

	"github.com/osmait/gestorDePresupuesto/cmd/api/boostrap"
)

//	@title			Budget Management System API
//	@version		1.0
//	@description	API for managing personal budget, transactions, accounts, and investments
//	@termsOfService	http://swagger.io/terms/

//	@contact.name	API Support
//	@contact.url	http://github.com/osmait/gestorDePresupuesto
//	@contact.email	support@gestordePresupuesto.com

//	@license.name	MIT
//	@license.url	https://opensource.org/licenses/MIT

//	@host		localhost:8080
//	@BasePath	/

//	@securityDefinitions.apikey	JWT
//	@in							header
//	@name						Authorization
//	@description				Type "Bearer" followed by a space and JWT token.

func main() {
	if err := boostrap.Run(); err != nil {
		log.Fatal(err)
	}
}
