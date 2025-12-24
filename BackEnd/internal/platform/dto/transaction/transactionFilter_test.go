package dto

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
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
				min := 100.50
				max := 999.99
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
			err := filter.ParseFromQuery(ctx)

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
					assert.Equal(t, *expected.AmountMin, *filter.AmountMin)
				} else {
					assert.Nil(t, filter.AmountMin)
				}

				if expected.AmountMax != nil {
					assert.NotNil(t, filter.AmountMax)
					assert.Equal(t, *expected.AmountMax, *filter.AmountMax)
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
				min := 100.0
				max := 50.0
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

func TestTransactionFilter_CalculateDates(t *testing.T) {
	tests := []struct {
		name           string
		filter         *TransactionFilter
		expectError    bool
		validateResult func(t *testing.T, filter *TransactionFilter)
	}{
		{
			name: "today period",
			filter: &TransactionFilter{
				Period: "today",
			},
			validateResult: func(t *testing.T, filter *TransactionFilter) {
				now := time.Now()
				expectedStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
				expectedEnd := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())

				assert.True(t, filter.CalculatedDateFrom.Equal(expectedStart))
				assert.True(t, filter.CalculatedDateTo.Year() == expectedEnd.Year() &&
					filter.CalculatedDateTo.Month() == expectedEnd.Month() &&
					filter.CalculatedDateTo.Day() == expectedEnd.Day())
			},
		},
		{
			name: "this_month period",
			filter: &TransactionFilter{
				Period: "this_month",
			},
			validateResult: func(t *testing.T, filter *TransactionFilter) {
				now := time.Now()
				expectedStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

				assert.True(t, filter.CalculatedDateFrom.Equal(expectedStart))
				assert.Equal(t, now.Month(), filter.CalculatedDateFrom.Month())
				assert.Equal(t, now.Year(), filter.CalculatedDateFrom.Year())
			},
		},
		{
			name: "explicit date range",
			filter: &TransactionFilter{
				DateFrom: "2024/01/01",
				DateTo:   "2024/12/31",
			},
			validateResult: func(t *testing.T, filter *TransactionFilter) {
				expectedStart := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
				expectedEnd := time.Date(2024, 12, 31, 23, 59, 59, 0, time.UTC)

				assert.Equal(t, expectedStart.Year(), filter.CalculatedDateFrom.Year())
				assert.Equal(t, expectedStart.Month(), filter.CalculatedDateFrom.Month())
				assert.Equal(t, expectedStart.Day(), filter.CalculatedDateFrom.Day())

				assert.Equal(t, expectedEnd.Year(), filter.CalculatedDateTo.Year())
				assert.Equal(t, expectedEnd.Month(), filter.CalculatedDateTo.Month())
				assert.Equal(t, expectedEnd.Day(), filter.CalculatedDateTo.Day())
			},
		},
		{
			name: "invalid period",
			filter: &TransactionFilter{
				Period: "invalid_period",
			},
			expectError: true,
		},
		{
			name: "invalid date format",
			filter: &TransactionFilter{
				DateFrom: "invalid-date",
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.filter.calculateDates()

			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				if tt.validateResult != nil {
					tt.validateResult(t, tt.filter)
				}
			}
		})
	}
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
				min := 100.0
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
