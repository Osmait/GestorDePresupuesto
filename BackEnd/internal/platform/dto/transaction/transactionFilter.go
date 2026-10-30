package dto

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
)

// TransactionFilter represents the filtering and pagination parameters for transaction queries
type TransactionFilter struct {
	// Pagination parameters
	Page   int `json:"page" example:"1"`
	Limit  int `json:"limit" example:"20"`
	Offset int `json:"offset" example:"0"`

	// Sorting parameters
	SortBy    string `json:"sort_by" example:"created_at"`
	SortOrder string `json:"sort_order" example:"desc" enums:"asc,desc"`

	// Type filter
	Type string `json:"type" example:"income" enums:"income,bill,all"`

	// Category filters
	CategoryId string   `json:"category_id" example:"cat_123456789"`
	Categories []string `json:"categories" example:"cat_1,cat_2,cat_3"`

	// Account filter
	AccountId string `json:"account_id" example:"acc_123456789"`

	// Budget filter
	BudgetId string `json:"budget_id" example:"budget_555666777"`

	// Date filters
	DateFrom string `json:"date_from" example:"2024/01/01"`
	DateTo   string `json:"date_to" example:"2024/12/31"`
	Period   string `json:"period" example:"this_month" enums:"today,this_week,this_month,this_year,last_week,last_month,last_year"`

	// Amount filters
	AmountMin *money.Amount `json:"amount_min" example:"0.00"`
	AmountMax *money.Amount `json:"amount_max" example:"1000.00"`

	// Search filter
	Search string `json:"search" example:"grocery"`

	// Internal fields for calculated values: the half-open range of instants
	// [CalculatedDateFrom, CalculatedDateTo). CalculatedDateTo is exclusive
	// (e.g. 00:00 local of the day after date_to). Zero = unbounded.
	CalculatedDateFrom time.Time `json:"-"`
	CalculatedDateTo   time.Time `json:"-"`
}

// allowedSortFields maps the accepted sort_by values to their canonical name.
// The frontend sends `transaction_name`; `name` is kept as an alias. The
// repository maps these canonical names to SQL columns.
var allowedSortFields = map[string]string{
	"created_at":       "created_at",
	"amount":           "amount",
	"transaction_name": "transaction_name",
	"name":             "transaction_name",
	"type_transation":  "type_transation",
}

// NewTransactionFilter creates a new TransactionFilter with default values
func NewTransactionFilter() *TransactionFilter {
	return &TransactionFilter{
		Page:      1,
		Limit:     20,
		Offset:    0,
		SortBy:    "created_at",
		SortOrder: "desc",
		Type:      "all",
	}
}

// ParseFromQuery parses query parameters from gin.Context and populates the
// TransactionFilter. loc is the app time zone that days and months are cut in
// (nil = apptime.Default()).
func (f *TransactionFilter) ParseFromQuery(ctx *gin.Context, loc *time.Location) error {
	// Parse pagination parameters
	if pageStr := ctx.Query("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page > 0 {
			f.Page = page
		}
	}

	if limitStr := ctx.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 && limit <= 100 {
			f.Limit = limit
		}
	}

	if offsetStr := ctx.Query("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil && offset >= 0 {
			f.Offset = offset
		}
	}

	// Calculate offset from page if not provided
	if f.Offset == 0 && f.Page > 1 {
		f.Offset = (f.Page - 1) * f.Limit
	}

	// Parse sorting parameters
	if sortBy := ctx.Query("sort_by"); sortBy != "" {
		if field, ok := allowedSortFields[sortBy]; ok {
			f.SortBy = field
		}
	}

	if sortOrder := ctx.Query("sort_order"); sortOrder != "" {
		if sortOrder == "asc" || sortOrder == "desc" {
			f.SortOrder = sortOrder
		}
	}

	// Parse type filter
	if typeFilter := ctx.Query("type"); typeFilter != "" {
		if typeFilter == "income" || typeFilter == "bill" || typeFilter == "all" {
			f.Type = typeFilter
		}
	}

	// Parse category filters
	f.CategoryId = ctx.Query("category_id")
	if categoriesStr := ctx.Query("categories"); categoriesStr != "" {
		f.Categories = strings.Split(categoriesStr, ",")
		// Clean up categories
		for i := range f.Categories {
			f.Categories[i] = strings.TrimSpace(f.Categories[i])
		}
	}

	// Parse account filter
	f.AccountId = ctx.Query("account_id")

	// Parse budget filter
	f.BudgetId = ctx.Query("budget_id")

	// Parse date filters
	f.DateFrom = ctx.Query("date_from")
	f.DateTo = ctx.Query("date_to")
	f.Period = ctx.Query("period")

	// Parse amount filters
	if amountMinStr := ctx.Query("amount_min"); amountMinStr != "" {
		if amountMin, err := money.Parse(amountMinStr); err == nil {
			f.AmountMin = &amountMin
		}
	}

	if amountMaxStr := ctx.Query("amount_max"); amountMaxStr != "" {
		if amountMax, err := money.Parse(amountMaxStr); err == nil {
			f.AmountMax = &amountMax
		}
	}

	// Parse search filter
	f.Search = strings.TrimSpace(ctx.Query("search"))

	// Process date calculations
	if err := f.calculateDates(time.Now(), loc); err != nil {
		return err
	}

	return nil
}

// calculateDates calculates the range of instants [CalculatedDateFrom,
// CalculatedDateTo) from the period or the explicit dates. Days, weeks and
// months are calendar ones in loc (the app time zone): date_from / date_to
// are local calendar days, so date_to=2026-10-31 includes Oct 31 up to 23:59
// local (Nov 1 03:59 UTC). Full RFC3339 values keep their exact instant.
func (f *TransactionFilter) calculateDates(now time.Time, loc *time.Location) error {
	loc = apptime.OrDefault(loc)

	if f.Period != "" {
		r, ok := apptime.Period(f.Period, now, loc)
		if !ok {
			return fmt.Errorf("invalid period: %s", f.Period)
		}
		f.CalculatedDateFrom, f.CalculatedDateTo = r.From, r.To
	} else {
		if f.DateFrom != "" {
			dateFrom, err := apptime.ParseRangeFrom(f.DateFrom, loc)
			if err != nil {
				return fmt.Errorf("invalid date_from format: %s", f.DateFrom)
			}
			f.CalculatedDateFrom = dateFrom
		}

		if f.DateTo != "" {
			dateTo, err := apptime.ParseRangeTo(f.DateTo, loc)
			if err != nil {
				return fmt.Errorf("invalid date_to format: %s", f.DateTo)
			}
			f.CalculatedDateTo = dateTo
		}
	}

	// Set default date range if none specified (last 30 days)
	if f.CalculatedDateFrom.IsZero() && f.CalculatedDateTo.IsZero() {
		f.CalculatedDateTo = now
		f.CalculatedDateFrom = now.AddDate(0, 0, -30)
	} else if f.CalculatedDateFrom.IsZero() {
		f.CalculatedDateFrom = f.CalculatedDateTo.AddDate(0, 0, -30)
	} else if f.CalculatedDateTo.IsZero() {
		f.CalculatedDateTo = f.CalculatedDateFrom.AddDate(0, 0, 30)
	}

	return nil
}

// Validate validates the filter parameters
func (f *TransactionFilter) Validate() error {
	if f.Limit <= 0 || f.Limit > 100 {
		return fmt.Errorf("limit must be between 1 and 100")
	}

	if f.Offset < 0 {
		return fmt.Errorf("offset must be non-negative")
	}

	if f.Page <= 0 {
		return fmt.Errorf("page must be positive")
	}

	if f.AmountMin != nil && f.AmountMax != nil && f.AmountMin.GreaterThan(*f.AmountMax) {
		return fmt.Errorf("amount_min cannot be greater than amount_max")
	}

	if !f.CalculatedDateFrom.IsZero() && !f.CalculatedDateTo.IsZero() && f.CalculatedDateFrom.After(f.CalculatedDateTo) {
		return fmt.Errorf("date_from cannot be after date_to")
	}

	return nil
}

// HasFilters returns true if any filters are applied (excluding pagination and sorting)
func (f *TransactionFilter) HasFilters() bool {
	return f.Type != "all" ||
		f.CategoryId != "" ||
		len(f.Categories) > 0 ||
		f.AccountId != "" ||
		f.BudgetId != "" ||
		f.AmountMin != nil ||
		f.AmountMax != nil ||
		f.Search != ""
}
