// Package moneybinding teaches gin's validator how to evaluate numeric
// binding tags (required, gt, gte, lte, ...) on money.Amount and
// money.NullAmount fields.
//
// validator/v10 only understands primitive kinds, so it would panic on a
// struct such as money.Amount. A custom type func exposes the value as a
// float64 for the comparison only; parsing and arithmetic stay exact.
//
// Every package that declares request structs with money fields and binding
// tags blank-imports this package so the registration happens before any
// request is bound, regardless of which binary (server or test) runs.
package moneybinding

import (
	"reflect"

	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

func init() {
	Register(binding.Validator.Engine())
}

// Register installs the money custom type funcs on engine when it is a
// *validator.Validate. It is idempotent.
func Register(engine any) {
	v, ok := engine.(*validator.Validate)
	if !ok {
		return
	}
	v.RegisterCustomTypeFunc(func(field reflect.Value) any {
		switch m := field.Interface().(type) {
		case money.Amount:
			return m.Float64()
		case money.NullAmount:
			if !m.Valid {
				return nil
			}
			return m.Amount.Float64()
		}
		return nil
	}, money.Amount{}, money.NullAmount{})
}
