package account

import (
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
)

type AccountResponse struct {
	AccountInfo    account.Account
	CurrentBalance float64
}
