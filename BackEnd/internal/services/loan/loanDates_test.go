package loan

import (
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
)

// Installments fall on the start date's day of month, clamped to the last day
// of shorter months (AddDate(0, n, 0) from Jan 31 gives Mar 3 for February).
func TestBuildInstallments_ClampsDueDatesToTheMonthsLastDay(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		start time.Time
		want  []string
	}{
		{"Jan 31", apptime.NoonUTC(2026, time.January, 31), []string{"2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"}},
		{"Jan 31 in a leap year", apptime.NoonUTC(2028, time.January, 31), []string{"2028-02-29", "2028-03-31", "2028-04-30", "2028-05-31"}},
		{"Aug 30", apptime.NoonUTC(2026, time.August, 30), []string{"2026-09-30", "2026-10-30", "2026-11-30", "2026-12-30"}},
		{"Nov 30 across the year", apptime.NoonUTC(2026, time.November, 30), []string{"2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"}},
		{"Oct 15", apptime.NoonUTC(2026, time.October, 15), []string{"2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			installments := buildInstallments(&loan.Loan{Id: "l", StartDate: tc.start, TermMonths: len(tc.want), TotalAmount: money.FromInt(400)})
			if len(installments) != len(tc.want) {
				t.Fatalf("got %d installments, want %d", len(installments), len(tc.want))
			}
			for i, inst := range installments {
				if got := inst.DueDate.UTC().Format("2006-01-02"); got != tc.want[i] {
					t.Errorf("installment %d due %s, want %s", i+1, got, tc.want[i])
				}
			}
		})
	}
}

func TestIsOverdue_UsesTheLocalCalendarDay(t *testing.T) {
	t.Parallel()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}
	dueDate := time.Date(2026, time.October, 31, 0, 0, 0, 0, time.UTC) // a DATE read back

	tests := []struct {
		name string
		now  time.Time
		want bool
	}{
		{"the evening before (already the due day in UTC)", time.Date(2026, 10, 30, 21, 0, 0, 0, loc), false},
		{"on the due day", time.Date(2026, 10, 31, 9, 0, 0, 0, loc), false},
		{"late on the due day (next day in UTC)", time.Date(2026, 10, 31, 22, 0, 0, 0, loc), false},
		{"the day after", time.Date(2026, 11, 1, 8, 0, 0, 0, loc), true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := isOverdue(dueDate, tc.now, loc); got != tc.want {
				t.Errorf("isOverdue(%s, %s) = %v, want %v", dueDate.Format("2006-01-02"), tc.now, got, tc.want)
			}
			// the in-memory due date of a new schedule (12:00 UTC) agrees
			if got := isOverdue(apptime.NoonUTC(2026, time.October, 31), tc.now, loc); got != tc.want {
				t.Errorf("isOverdue(noon UTC) at %s = %v, want %v", tc.now, got, tc.want)
			}
		})
	}
}

// Date-only loan dates are the calendar day at 12:00 UTC (the same day in
// Santo Domingo); at 00:00 UTC they were the previous local evening.
func TestParsedLoanDates(t *testing.T) {
	t.Parallel()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}
	now := time.Date(2026, time.October, 31, 22, 0, 0, 0, loc) // Nov 1 02:00 UTC

	tests := []struct {
		name string
		got  time.Time
		want time.Time
	}{
		{"start date given", (&dto.CreateLoanRequest{StartDate: "2026-10-15"}).ParsedStartDate(now, loc), apptime.NoonUTC(2026, time.October, 15)},
		{"start date empty is today in Santo Domingo", (&dto.CreateLoanRequest{}).ParsedStartDate(now, loc), apptime.NoonUTC(2026, time.October, 31)},
		{"start date invalid is today", (&dto.CreateLoanRequest{StartDate: "mañana"}).ParsedStartDate(now, loc), apptime.NoonUTC(2026, time.October, 31)},
		{"payment date given", (&dto.RegisterLoanPaymentRequest{PaymentDate: "2026-10-31"}).ParsedPaymentDate(now), apptime.NoonUTC(2026, time.October, 31)},
		{"payment date empty is now", (&dto.RegisterLoanPaymentRequest{}).ParsedPaymentDate(now), now},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if !tc.got.Equal(tc.want) {
				t.Errorf("got %s, want %s", tc.got.UTC(), tc.want.UTC())
			}
			if got := tc.got.In(loc).Format("2006-01-02"); got != tc.want.In(loc).Format("2006-01-02") {
				t.Errorf("local day %s", got)
			}
		})
	}
}
