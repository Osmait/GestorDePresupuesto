// Package moneytest provides test assertions for money.Amount.
//
// money.Amount must be compared numerically (1.50 == 1.5), not with
// reflect.DeepEqual, which also compares the internal scale.
package moneytest

import (
	"fmt"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// A converts a test literal (string, int, int64, float64 or money.Amount)
// to an Amount. Floats use their shortest decimal representation.
func A(v any) money.Amount {
	switch x := v.(type) {
	case money.Amount:
		return x
	case *money.Amount:
		if x == nil {
			panic("moneytest: nil *money.Amount")
		}
		return *x
	case string:
		return money.MustParse(x)
	case int:
		return money.FromInt(int64(x))
	case int64:
		return money.FromInt(x)
	case float64:
		return money.FromFloat(x)
	default:
		panic(fmt.Sprintf("moneytest: unsupported type %T", v))
	}
}

// Equal fails the test unless got equals want numerically.
func Equal(t testing.TB, want any, got money.Amount, msgAndArgs ...any) bool {
	t.Helper()
	w := A(want)
	if w.Equal(got) {
		return true
	}
	msg := ""
	if len(msgAndArgs) > 0 {
		if format, ok := msgAndArgs[0].(string); ok {
			msg = ": " + fmt.Sprintf(format, msgAndArgs[1:]...)
		}
	}
	t.Errorf("amounts differ: want %s, got %s%s", w, got, msg)
	return false
}
