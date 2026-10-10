package money_test

// Micro-benchmarks for the exact-money type against the float64 it replaced.
//
//	go test ./internal/domain/money -run '^$' -bench . -benchmem
//
// The "page" benchmarks encode/decode a 100-row transaction page, the shape
// of GET /transaction?limit=100 (the dashboard's findAllSimple page size).

import (
	"encoding/json"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

var (
	sinkBytes  []byte
	sinkAmount money.Amount
	sinkFloat  float64
)

type txAmount struct {
	Id             string       `json:"id"`
	Name           string       `json:"name"`
	Description    string       `json:"description"`
	Amount         money.Amount `json:"amount"`
	TypeTransation string       `json:"type_transation"`
	AccountId      string       `json:"account_id"`
	CategoryId     string       `json:"category_id"`
	BudgetId       string       `json:"budget_id"`
	Currency       string       `json:"currency"`
	CreatedAt      time.Time    `json:"created_at"`
}

type txFloat struct {
	Id             string    `json:"id"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	Amount         float64   `json:"amount"`
	TypeTransation string    `json:"type_transation"`
	AccountId      string    `json:"account_id"`
	CategoryId     string    `json:"category_id"`
	BudgetId       string    `json:"budget_id"`
	Currency       string    `json:"currency"`
	CreatedAt      time.Time `json:"created_at"`
}

func amountsText(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("%d.%02d", 50+(i*7919)%8000, (i*31)%100)
	}
	return out
}

func pageAmount(n int) []*txAmount {
	ts := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)
	out := make([]*txAmount, n)
	for i, s := range amountsText(n) {
		out[i] = &txAmount{Id: fmt.Sprintf("pt%025d", i), Name: "Supermercado Nacional", Description: "seed tx",
			Amount: money.MustParse(s), TypeTransation: "bill", AccountId: "pa0000000000000000000000001",
			CategoryId: "pc0000000000000000000000004", Currency: "DOP", CreatedAt: ts}
	}
	return out
}

func pageFloat(n int) []*txFloat {
	ts := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)
	out := make([]*txFloat, n)
	for i, s := range amountsText(n) {
		f, _ := strconv.ParseFloat(s, 64)
		out[i] = &txFloat{Id: fmt.Sprintf("pt%025d", i), Name: "Supermercado Nacional", Description: "seed tx",
			Amount: f, TypeTransation: "bill", AccountId: "pa0000000000000000000000001",
			CategoryId: "pc0000000000000000000000004", Currency: "DOP", CreatedAt: ts}
	}
	return out
}

func BenchmarkMarshalScalar(b *testing.B) {
	a := money.MustParse("1234.56")
	f := 1234.56
	b.Run("Amount", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			sinkBytes, _ = json.Marshal(a)
		}
	})
	b.Run("float64", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			sinkBytes, _ = json.Marshal(f)
		}
	})
}

func BenchmarkUnmarshalScalar(b *testing.B) {
	in := []byte("1234.56")
	b.Run("Amount", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			var a money.Amount
			_ = json.Unmarshal(in, &a)
			sinkAmount = a
		}
	})
	b.Run("float64", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			var f float64
			_ = json.Unmarshal(in, &f)
			sinkFloat = f
		}
	})
}

// BenchmarkScan mirrors what database/sql hands a NUMERIC column to: []byte.
func BenchmarkScan(b *testing.B) {
	src := []byte("1234.5600")
	b.Run("Amount", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			var a money.Amount
			_ = a.Scan(src)
			sinkAmount = a
		}
	})
	b.Run("float64", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			sinkFloat, _ = strconv.ParseFloat(string(src), 64)
		}
	})
}

// BenchmarkSum1000 is the in-Go aggregation pattern (balances, budget
// progress, dashboard totals).
func BenchmarkSum1000(b *testing.B) {
	txt := amountsText(1000)
	am := make([]money.Amount, len(txt))
	fl := make([]float64, len(txt))
	for i, s := range txt {
		am[i] = money.MustParse(s)
		fl[i], _ = strconv.ParseFloat(s, 64)
	}
	b.Run("Amount", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			sinkAmount = money.Sum(am...)
		}
	})
	b.Run("float64", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			s := 0.0
			for _, f := range fl {
				s += f
			}
			sinkFloat = s
		}
	})
}

func BenchmarkEncodePage100(b *testing.B) {
	pa, pf := pageAmount(100), pageFloat(100)
	b.Run("Amount", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			sinkBytes, _ = json.Marshal(pa)
		}
		b.SetBytes(int64(len(sinkBytes)))
	})
	b.Run("float64", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			sinkBytes, _ = json.Marshal(pf)
		}
		b.SetBytes(int64(len(sinkBytes)))
	})
}

func BenchmarkDecodePage100(b *testing.B) {
	ja, _ := json.Marshal(pageAmount(100))
	jf, _ := json.Marshal(pageFloat(100))
	b.Run("Amount", func(b *testing.B) {
		b.ReportAllocs()
		b.SetBytes(int64(len(ja)))
		for i := 0; i < b.N; i++ {
			var out []*txAmount
			_ = json.Unmarshal(ja, &out)
		}
	})
	b.Run("float64", func(b *testing.B) {
		b.ReportAllocs()
		b.SetBytes(int64(len(jf)))
		for i := 0; i < b.N; i++ {
			var out []*txFloat
			_ = json.Unmarshal(jf, &out)
		}
	})
}
