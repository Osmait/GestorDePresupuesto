package loan

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
)

func TestBuildInstallments_SumExactlyToTotal(t *testing.T) {
	t.Parallel()

	tests := []struct {
		total     string
		months    int
		base      string
		lastShare string
	}{
		{"1000", 3, "333.33", "333.34"},
		{"100", 7, "14.29", "14.26"},
		{"0.10", 3, "0.03", "0.04"},
		{"1000000000.01", 12, "83333333.33", "83333333.38"},
	}
	for _, tt := range tests {
		t.Run(tt.total, func(t *testing.T) {
			t.Parallel()
			entity := &loan.Loan{Id: "l", TotalAmount: money.MustParse(tt.total), TermMonths: tt.months, StartDate: time.Now()}
			installments := buildInstallments(entity)
			assert.Len(t, installments, tt.months)

			sum := money.Zero
			for _, inst := range installments[:len(installments)-1] {
				moneytest.Equal(t, tt.base, inst.ExpectedAmount)
				sum = sum.Add(inst.ExpectedAmount)
			}
			last := installments[len(installments)-1].ExpectedAmount
			moneytest.Equal(t, tt.lastShare, last)
			moneytest.Equal(t, tt.total, sum.Add(last))
		})
	}
}
