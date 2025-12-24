package dto

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
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
	AmountMin *float64 `json:"amount_min" example:"0.00"`
	AmountMax *float64 `json:"amount_max" example:"1000.00"`

	// Search filter
	Search string `json:"search" example:"grocery"`

	// Internal fields for calculated values
	CalculatedDateFrom time.Time `json:"-"`
	CalculatedDateTo   time.Time `json:"-"`
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

// ParseFromQuery parses query parameters from gin.Context and populates the TransactionFilter
func (f *TransactionFilter) ParseFromQuery(ctx *gin.Context) error {
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
		// Validate allowed sort fields
		allowedSortFields := []string{"created_at", "amount", "name", "type_transation"}
		for _, field := range allowedSortFields {
			if sortBy == field {
				f.SortBy = sortBy
				break
			}
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
		if amountMin, err := strconv.ParseFloat(amountMinStr, 64); err == nil {
			f.AmountMin = &amountMin
		}
	}

	if amountMaxStr := ctx.Query("amount_max"); amountMaxStr != "" {
		if amountMax, err := strconv.ParseFloat(amountMaxStr, 64); err == nil {
			f.AmountMax = &amountMax
		}
	}

	// Parse search filter
	f.Search = strings.TrimSpace(ctx.Query("search"))

	// Process date calculations
	if err := f.calculateDates(); err != nil {
		return err
	}

	return nil
}

// calculateDates calculates the actual date range based on the provided parameters
func (f *TransactionFilter) calculateDates() error {
	now := time.Now()

	// If period is specified, calculate dates based on period
	if f.Period != "" {
		switch f.Period {
		case "today":
			f.CalculatedDateFrom = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			f.CalculatedDateTo = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
		case "this_week":
			weekday := int(now.Weekday())
			if weekday == 0 { // Sunday
				weekday = 7
			}
			f.CalculatedDateFrom = now.AddDate(0, 0, -(weekday - 1)).Truncate(24 * time.Hour)
			f.CalculatedDateTo = f.CalculatedDateFrom.AddDate(0, 0, 6).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		case "this_month":
			f.CalculatedDateFrom = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
			f.CalculatedDateTo = f.CalculatedDateFrom.AddDate(0, 1, 0).Add(-time.Nanosecond)
		case "this_year":
			f.CalculatedDateFrom = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
			f.CalculatedDateTo = time.Date(now.Year()+1, 1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
		case "last_week":
			weekday := int(now.Weekday())
			if weekday == 0 { // Sunday
				weekday = 7
			}
			f.CalculatedDateFrom = now.AddDate(0, 0, -(weekday + 6)).Truncate(24 * time.Hour)
			f.CalculatedDateTo = f.CalculatedDateFrom.AddDate(0, 0, 6).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		case "last_month":
			lastMonth := now.AddDate(0, -1, 0)
			f.CalculatedDateFrom = time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, now.Location())
			f.CalculatedDateTo = time.Date(lastMonth.Year(), lastMonth.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
		case "last_year":
			f.CalculatedDateFrom = time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, now.Location())
			f.CalculatedDateTo = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
		default:
			return fmt.Errorf("invalid period: %s", f.Period)
		}
	} else {
		// Parse explicit date strings
		if f.DateFrom != "" {
			if dateFrom, err := parseDate(f.DateFrom); err == nil {
				f.CalculatedDateFrom = dateFrom
			} else {
				return fmt.Errorf("invalid date_from format: %s", f.DateFrom)
			}
		}

		if f.DateTo != "" {
			if dateTo, err := parseDate(f.DateTo); err == nil {
				f.CalculatedDateTo = dateTo.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			} else {
				return fmt.Errorf("invalid date_to format: %s", f.DateTo)
			}
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

// parseDate parses date string in YYYY/MM/DD format
func parseDate(dateStr string) (time.Time, error) {
	layouts := []string{
		"2006/01/02",
		"2006-01-02",
		"02/01/2006",
		"02-01-2006",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, dateStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse date: %s", dateStr)
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

	if f.AmountMin != nil && f.AmountMax != nil && *f.AmountMin > *f.AmountMax {
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
