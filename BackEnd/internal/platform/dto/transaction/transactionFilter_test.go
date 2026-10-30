package dto

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewTransactionFilter(t *testing.T) {
	filter := NewTransactionFilter()

	assert.Equal(t, 1, filter.Page)
	assert.Equal(t, 20, filter.Limit)
	assert.Equal(t, 0, filter.Offset)
	assert.Equal(t, "created_at", filter.SortBy)
	assert.Equal(t, "desc", filter.SortOrder)
	assert.Equal(t, "all", filter.Type)
}

func TestTransactionFilter_ParseFromQuery(t *testing.T) {
	tests := []struct {
		name           string
		queryParams    map[string]string
		expectedFilter func() *TransactionFilter
		expectError    bool
	}{
		{
			name: "basic pagination",
			queryParams: map[string]string{
				"page":  "2",
				"limit": "50",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.Page = 2
				f.Limit = 50
				f.Offset = 50 // (page-1) * limit
				return f
			},
		},
		{
			name: "sorting parameters",
			queryParams: map[string]string{
				"sort_by":    "amount",
				"sort_order": "asc",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.SortBy = "amount"
				f.SortOrder = "asc"
				return f
			},
		},
		{
			name: "sort by transaction_name (sent by the frontend)",
			queryParams: map[string]string{
				"sort_by":    "transaction_name",
				"sort_order": "asc",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.SortBy = "transaction_name"
				f.SortOrder = "asc"
				return f
			},
		},
		{
			name: "sort by name is an alias of transaction_name",
			queryParams: map[string]string{
				"sort_by": "name",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.SortBy = "transaction_name"
				return f
			},
		},
		{
			name: "filtering parameters",
			queryParams: map[string]string{
				"type":        "income",
				"category_id": "cat_123",
				"account_id":  "acc_456",
				"budget_id":   "budget_789",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.Type = "income"
				f.CategoryId = "cat_123"
				f.AccountId = "acc_456"
				f.BudgetId = "budget_789"
				return f
			},
		},
		{
			name: "amount filters",
			queryParams: map[string]string{
				"amount_min": "100.50",
				"amount_max": "999.99",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				min := money.MustParse("100.50")
				max := money.MustParse("999.99")
				f.AmountMin = &min
				f.AmountMax = &max
				return f
			},
		},
		{
			name: "search filter",
			queryParams: map[string]string{
				"search": "grocery store",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.Search = "grocery store"
				return f
			},
		},
		{
			name: "date filters",
			queryParams: map[string]string{
				"date_from": "2024/01/01",
				"date_to":   "2024/12/31",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.DateFrom = "2024/01/01"
				f.DateTo = "2024/12/31"
				return f
			},
		},
		{
			name: "period filter",
			queryParams: map[string]string{
				"period": "this_month",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.Period = "this_month"
				return f
			},
		},
		{
			name: "multiple categories",
			queryParams: map[string]string{
				"categories": "cat_1,cat_2,cat_3",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				f.Categories = []string{"cat_1", "cat_2", "cat_3"}
				return f
			},
		},
		{
			name: "invalid sort field - should use default",
			queryParams: map[string]string{
				"sort_by": "invalid_field",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				// Should keep default sort_by
				return f
			},
		},
		{
			name: "invalid type - should use default",
			queryParams: map[string]string{
				"type": "invalid_type",
			},
			expectedFilter: func() *TransactionFilter {
				f := NewTransactionFilter()
				// Should keep default type
				return f
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a gin context with query parameters
			ctx := createGinContextWithQuery(tt.queryParams)

			filter := NewTransactionFilter()
			err := filter.ParseFromQuery(ctx, nil)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				expected := tt.expectedFilter()

				// Compare basic fields
				assert.Equal(t, expected.Page, filter.Page)
				assert.Equal(t, expected.Limit, filter.Limit)
				assert.Equal(t, expected.SortBy, filter.SortBy)
				assert.Equal(t, expected.SortOrder, filter.SortOrder)
				assert.Equal(t, expected.Type, filter.Type)
				assert.Equal(t, expected.CategoryId, filter.CategoryId)
				assert.Equal(t, expected.AccountId, filter.AccountId)
				assert.Equal(t, expected.BudgetId, filter.BudgetId)
				assert.Equal(t, expected.Search, filter.Search)
				assert.Equal(t, expected.Categories, filter.Categories)

				// Compare amount filters
				if expected.AmountMin != nil {
					assert.NotNil(t, filter.AmountMin)
					moneytest.Equal(t, *expected.AmountMin, *filter.AmountMin)
				} else {
					assert.Nil(t, filter.AmountMin)
				}

				if expected.AmountMax != nil {
					assert.NotNil(t, filter.AmountMax)
					moneytest.Equal(t, *expected.AmountMax, *filter.AmountMax)
				} else {
					assert.Nil(t, filter.AmountMax)
				}
			}
		})
	}
}

func TestTransactionFilter_Validate(t *testing.T) {
	tests := []struct {
		name        string
		filter      *TransactionFilter
		expectError bool
		errorMsg    string
	}{
		{
			name:        "valid filter",
			filter:      NewTransactionFilter(),
			expectError: false,
		},
		{
			name: "invalid limit - too high",
			filter: &TransactionFilter{
				Page:  1,
				Limit: 150, // Max is 100
			},
			expectError: true,
			errorMsg:    "limit must be between 1 and 100",
		},
		{
			name: "invalid limit - zero",
			filter: &TransactionFilter{
				Page:  1,
				Limit: 0,
			},
			expectError: true,
			errorMsg:    "limit must be between 1 and 100",
		},
		{
			name: "invalid offset",
			filter: &TransactionFilter{
				Page:   1,
				Limit:  20,
				Offset: -1,
			},
			expectError: true,
			errorMsg:    "offset must be non-negative",
		},
		{
			name: "invalid page",
			filter: &TransactionFilter{
				Page:  0,
				Limit: 20,
			},
			expectError: true,
			errorMsg:    "page must be positive",
		},
		{
			name: "invalid amount range",
			filter: func() *TransactionFilter {
				f := NewTransactionFilter()
				min := money.FromInt(100)
				max := money.FromInt(50)
				f.AmountMin = &min
				f.AmountMax = &max
				return f
			}(),
			expectError: true,
			errorMsg:    "amount_min cannot be greater than amount_max",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.filter.Validate()

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// Days and months are cut in the app time zone (Santo Domingo, UTC-4), so a
// bill paid on Sep 30 at 23:30 local (Oct 1 03:30 UTC) is not in October and
// one paid on Oct 31 at 21:30 local (Nov 1 01:30 UTC) is. Ranges are half-open
// [CalculatedDateFrom, CalculatedDateTo).
func TestTransactionFilter_CalculateDates(t *testing.T) {
	t.Parallel()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	require.NoError(t, err)
	local := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, loc) }
	// Saturday Oct 31 2026, 22:00 local = Sunday Nov 1 02:00 UTC
	now := time.Date(2026, time.October, 31, 22, 0, 0, 0, loc)

	tests := []struct {
		name             string
		filter           TransactionFilter
		wantFrom, wantTo time.Time
		expectError      bool
	}{
		{name: "today", filter: TransactionFilter{Period: "today"}, wantFrom: local(2026, 10, 31), wantTo: local(2026, 11, 1)},
		{name: "this_week (Monday to Sunday)", filter: TransactionFilter{Period: "this_week"}, wantFrom: local(2026, 10, 26), wantTo: local(2026, 11, 2)},
		{name: "last_week", filter: TransactionFilter{Period: "last_week"}, wantFrom: local(2026, 10, 19), wantTo: local(2026, 10, 26)},
		{name: "this_month", filter: TransactionFilter{Period: "this_month"}, wantFrom: local(2026, 10, 1), wantTo: local(2026, 11, 1)},
		{name: "last_month on Oct 31 is September", filter: TransactionFilter{Period: "last_month"}, wantFrom: local(2026, 9, 1), wantTo: local(2026, 10, 1)},
		{name: "this_year", filter: TransactionFilter{Period: "this_year"}, wantFrom: local(2026, 1, 1), wantTo: local(2027, 1, 1)},
		{name: "last_year", filter: TransactionFilter{Period: "last_year"}, wantFrom: local(2025, 1, 1), wantTo: local(2026, 1, 1)},
		{name: "explicit October", filter: TransactionFilter{DateFrom: "2026-10-01", DateTo: "2026-10-31"}, wantFrom: local(2026, 10, 1), wantTo: local(2026, 11, 1)},
		{name: "slashes", filter: TransactionFilter{DateFrom: "2024/01/01", DateTo: "2024/12/31"}, wantFrom: local(2024, 1, 1), wantTo: local(2025, 1, 1)},
		{name: "single day", filter: TransactionFilter{DateFrom: "2026-10-31", DateTo: "2026-10-31"}, wantFrom: local(2026, 10, 31), wantTo: local(2026, 11, 1)},
		{
			name:     "RFC3339 bounds keep their instant",
			filter:   TransactionFilter{DateFrom: "2026-10-31T20:00:00-04:00", DateTo: "2026-11-01T01:30:00Z"},
			wantFrom: time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC),
			wantTo:   time.Date(2026, 11, 1, 1, 30, 0, 1000, time.UTC),
		},
		{name: "only date_from: 30 days", filter: TransactionFilter{DateFrom: "2026-10-01"}, wantFrom: local(2026, 10, 1), wantTo: local(2026, 10, 31)},
		{name: "no dates: last 30 days up to now", filter: TransactionFilter{}, wantFrom: now.AddDate(0, 0, -30), wantTo: now},
		{name: "invalid period", filter: TransactionFilter{Period: "invalid_period"}, expectError: true},
		{name: "invalid date format", filter: TransactionFilter{DateFrom: "invalid-date"}, expectError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := tt.filter
			err := f.calculateDates(now, loc)
			if tt.expectError {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.True(t, f.CalculatedDateFrom.Equal(tt.wantFrom), "from: want %s got %s", tt.wantFrom, f.CalculatedDateFrom)
			assert.True(t, f.CalculatedDateTo.Equal(tt.wantTo), "to: want %s got %s", tt.wantTo, f.CalculatedDateTo)
		})
	}

	// the reproduced bug: the October filter
	f := TransactionFilter{DateFrom: "2026-10-01", DateTo: "2026-10-31"}
	require.NoError(t, f.calculateDates(now, loc))
	in := func(at time.Time) bool { return !at.Before(f.CalculatedDateFrom) && at.Before(f.CalculatedDateTo) }
	assert.True(t, in(time.Date(2026, 10, 31, 21, 30, 0, 0, loc)), "Oct 31 21:30 local must be in October")
	assert.False(t, in(time.Date(2026, 9, 30, 23, 30, 0, 0, loc)), "Sep 30 23:30 local must not be in October")
}

func TestTransactionFilter_HasFilters(t *testing.T) {
	tests := []struct {
		name           string
		filter         *TransactionFilter
		expectedResult bool
	}{
		{
			name:           "no filters",
			filter:         NewTransactionFilter(),
			expectedResult: false,
		},
		{
			name: "has type filter",
			filter: &TransactionFilter{
				Type: "income",
			},
			expectedResult: true,
		},
		{
			name: "has category filter",
			filter: &TransactionFilter{
				CategoryId: "cat_123",
			},
			expectedResult: true,
		},
		{
			name: "has search filter",
			filter: &TransactionFilter{
				Search: "grocery",
			},
			expectedResult: true,
		},
		{
			name: "has amount filter",
			filter: func() *TransactionFilter {
				f := NewTransactionFilter()
				min := money.FromInt(100)
				f.AmountMin = &min
				return f
			}(),
			expectedResult: true,
		},
		{
			name: "only pagination - no filters",
			filter: &TransactionFilter{
				Page:      2,
				Limit:     50,
				SortBy:    "amount",
				SortOrder: "asc",
				Type:      "all",
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.filter.HasFilters()
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

// Helper function to create a gin context with query parameters
func createGinContextWithQuery(params map[string]string) *gin.Context {
	gin.SetMode(gin.TestMode)

	req := &http.Request{
		URL: &url.URL{},
	}

	q := req.URL.Query()
	for key, value := range params {
		q.Add(key, value)
	}
	req.URL.RawQuery = q.Encode()

	ctx, _ := gin.CreateTestContext(nil)
	ctx.Request = req

	return ctx
}
