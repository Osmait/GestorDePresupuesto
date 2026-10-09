package dto

// Registers money.Amount support in gin's validator before any request
// struct of this package is bound.
import _ "github.com/osmait/gestorDePresupuesto/internal/platform/dto/moneybinding"
