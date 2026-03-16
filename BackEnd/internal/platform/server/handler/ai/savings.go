package ai

import (
	"context"
	"database/sql"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/segmentio/ksuid"
)

func (h *Handler) SavingsPlan(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.SavingsPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	averageMonthlySavings, err := h.calculateAverageMonthlySavings(c.Request.Context(), userID, req.AccountID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to fetch transactions for savings plan", err))
		return
	}

	planningMonths := resolvePlanningMonths(req.TargetDate)
	recommendedMonthly, recommendedWeekly, estimatedMonths := buildSavingsPlan(req.TargetAmount, averageMonthlySavings, planningMonths)
	feasibleByDate := isTargetFeasibleByDate(req.TargetDate, estimatedMonths)
	targetDate := strings.TrimSpace(req.TargetDate)

	c.JSON(http.StatusOK, dto.SavingsPlanResponse{
		Success: true,
		Data: dto.SavingsPlanData{
			TargetAmount:            req.TargetAmount,
			CurrentAverageSavings:   averageMonthlySavings,
			RecommendedMonthlySave:  recommendedMonthly,
			RecommendedWeeklySave:   recommendedWeekly,
			EstimatedMonthsToTarget: estimatedMonths,
			FeasibleByDate:          feasibleByDate,
			TargetDate:              targetDate,
		},
	})
}

func (h *Handler) CreateSavingsGoal(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.CreateSavingsGoalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	goalID := ksuid.New().String()
	now := time.Now()
	targetDate, err := parseOptionalDate(req.TargetDate)
	if err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_DATE", "Invalid target_date format, expected YYYY-MM-DD"))
		return
	}

	_, err = h.db.ExecContext(
		c.Request.Context(),
		`INSERT INTO savings_goals
			(id, user_id, name, target_amount, current_saved, target_date, account_id, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), 'active', $8, $9)`,
		goalID,
		userID,
		strings.TrimSpace(req.Name),
		req.TargetAmount,
		math.Max(req.CurrentSaved, 0),
		targetDate,
		strings.TrimSpace(req.AccountID),
		now,
		now,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to create savings goal", err))
		return
	}

	goal, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to load created savings goal", err))
		return
	}

	c.JSON(http.StatusOK, dto.SavingsGoalResponse{Success: true, Data: goal})
}

func (h *Handler) ListSavingsGoals(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	rows, err := h.db.QueryContext(
		c.Request.Context(),
		`SELECT id, name, target_amount, current_saved, target_date, account_id, status, created_at, updated_at
		 FROM savings_goals
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to list savings goals", err))
		return
	}
	defer func() { _ = rows.Close() }()

	goals := make([]dto.SavingsGoal, 0)
	for rows.Next() {
		goal, scanErr := scanSavingsGoal(rows)
		if scanErr != nil {
			_ = c.Error(apperrors.NewInternalError("Failed to parse savings goals", scanErr))
			return
		}
		goals = append(goals, goal)
	}

	if err := rows.Err(); err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed while reading savings goals", err))
		return
	}

	c.JSON(http.StatusOK, dto.SavingsGoalListResponse{Success: true, Data: goals})
}

func (h *Handler) UpdateSavingsGoal(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	goalID := c.Param("goal_id")

	var req dto.UpdateSavingsGoalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	current, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewNotFoundError("SAVINGS_GOAL_NOT_FOUND", "Savings goal not found"))
			return
		}
		_ = c.Error(apperrors.NewInternalError("Failed to load savings goal", err))
		return
	}

	name := current.Name
	if strings.TrimSpace(req.Name) != "" {
		name = strings.TrimSpace(req.Name)
	}

	targetAmount := current.TargetAmount
	if req.TargetAmount > 0 {
		targetAmount = req.TargetAmount
	}

	currentSaved := current.CurrentSaved
	if req.CurrentSaved >= 0 {
		currentSaved = req.CurrentSaved
	}

	status := current.Status
	if strings.TrimSpace(req.Status) != "" {
		status = strings.TrimSpace(req.Status)
	}

	accountID := current.AccountID
	if req.AccountID != "" {
		accountID = req.AccountID
	}

	targetDateNT := sql.NullTime{}
	if req.TargetDate != "" {
		parsedDate, parseErr := parseOptionalDate(req.TargetDate)
		if parseErr != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_DATE", "Invalid target_date format, expected YYYY-MM-DD"))
			return
		}
		targetDateNT = parsedDate
	} else if current.TargetDate != "" {
		if parsedDate, parseErr := time.Parse("2006-01-02", current.TargetDate); parseErr == nil {
			targetDateNT = sql.NullTime{Time: parsedDate, Valid: true}
		}
	}

	_, err = h.db.ExecContext(
		c.Request.Context(),
		`UPDATE savings_goals
		 SET name = $1,
		     target_amount = $2,
		     current_saved = $3,
		     target_date = $4,
		     account_id = NULLIF($5, ''),
		     status = $6,
		     updated_at = $7
		 WHERE id = $8 AND user_id = $9`,
		name,
		targetAmount,
		currentSaved,
		targetDateNT,
		accountID,
		status,
		time.Now(),
		goalID,
		userID,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to update savings goal", err))
		return
	}

	updated, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to load updated savings goal", err))
		return
	}

	c.JSON(http.StatusOK, dto.SavingsGoalResponse{Success: true, Data: updated})
}

func (h *Handler) DeleteSavingsGoal(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	goalID := c.Param("goal_id")

	result, err := h.db.ExecContext(
		c.Request.Context(),
		`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2`,
		goalID,
		userID,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to delete savings goal", err))
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		_ = c.Error(apperrors.NewNotFoundError("SAVINGS_GOAL_NOT_FOUND", "Savings goal not found"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) GetSavingsGoalProgress(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	goalID := c.Param("goal_id")

	goal, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewNotFoundError("SAVINGS_GOAL_NOT_FOUND", "Savings goal not found"))
			return
		}
		_ = c.Error(apperrors.NewInternalError("Failed to load savings goal", err))
		return
	}

	averageMonthlySavings, err := h.calculateAverageMonthlySavings(c.Request.Context(), userID, goal.AccountID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to calculate savings progress", err))
		return
	}

	remaining := goal.TargetAmount - goal.CurrentSaved
	if remaining < 0 {
		remaining = 0
	}
	planningMonths := resolvePlanningMonths(goal.TargetDate)
	recommendedMonthly, recommendedWeekly, estimatedMonths := buildSavingsPlan(remaining, averageMonthlySavings, planningMonths)
	feasibleByDate := isTargetFeasibleByDate(goal.TargetDate, estimatedMonths)

	c.JSON(http.StatusOK, dto.SavingsGoalProgressResponse{
		Success: true,
		Data: dto.SavingsGoalProgressData{
			Goal:                    goal,
			CurrentAverageSavings:   averageMonthlySavings,
			RecommendedMonthlySave:  recommendedMonthly,
			RecommendedWeeklySave:   recommendedWeekly,
			EstimatedMonthsToTarget: estimatedMonths,
			FeasibleByDate:          feasibleByDate,
		},
	})
}

func (h *Handler) calculateAverageMonthlySavings(ctx context.Context, userID string, accountID string) (float64, error) {
	dateTo := time.Now()
	dateFrom := dateTo.AddDate(0, -3, 0)
	transactions, err := h.transactionRepository.FindByUserAndDateRange(ctx, userID, dateFrom, dateTo)
	if err != nil {
		return 0, err
	}

	totalIncome := 0.0
	totalExpense := 0.0
	for _, txn := range transactions {
		if txn == nil {
			continue
		}
		if accountID != "" && txn.AccountId != accountID {
			continue
		}
		amount := math.Abs(txn.Amount)
		switch txn.TypeTransation {
		case "income":
			totalIncome += amount
		case "bill":
			totalExpense += amount
		}
	}

	averageMonthlySavings := (totalIncome - totalExpense) / 3
	if averageMonthlySavings < 0 {
		averageMonthlySavings = 0
	}

	return averageMonthlySavings, nil
}

func buildSavingsPlan(targetAmount float64, averageMonthlySavings float64, planningMonths int) (float64, float64, int) {
	if planningMonths <= 0 {
		planningMonths = 6
	}

	recommendedMonthly := averageMonthlySavings
	if targetAmount > 0 {
		targetByPlan := targetAmount / float64(planningMonths)
		recommendedMonthly = math.Max(targetByPlan, averageMonthlySavings)
	}

	recommendedWeekly := recommendedMonthly / 4.33
	estimatedMonths := 0
	if recommendedMonthly > 0 {
		estimatedMonths = int(math.Ceil(targetAmount / recommendedMonthly))
	}
	return recommendedMonthly, recommendedWeekly, estimatedMonths
}

func resolvePlanningMonths(targetDate string) int {
	const defaultPlanningMonths = 6

	monthsAvailable, ok := monthsUntilTargetDate(targetDate)
	if !ok {
		return defaultPlanningMonths
	}
	if monthsAvailable < 1 {
		return 1
	}

	return monthsAvailable
}

func isTargetFeasibleByDate(targetDate string, estimatedMonths int) bool {
	monthsAvailable, ok := monthsUntilTargetDate(targetDate)
	if !ok {
		return false
	}

	return estimatedMonths > 0 && estimatedMonths <= monthsAvailable
}

func monthsUntilTargetDate(targetDate string) (int, bool) {
	targetDate = strings.TrimSpace(targetDate)
	if targetDate == "" {
		return 0, false
	}

	parsedDate, err := time.Parse("2006-01-02", targetDate)
	if err != nil {
		return 0, false
	}

	monthsAvailable := int(math.Ceil(time.Until(parsedDate).Hours() / (24 * 30)))
	if monthsAvailable < 0 {
		monthsAvailable = 0
	}

	return monthsAvailable, true
}

func parseOptionalDate(value string) (sql.NullTime, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return sql.NullTime{}, nil
	}

	parsedDate, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return sql.NullTime{}, err
	}

	return sql.NullTime{Time: parsedDate, Valid: true}, nil
}

func scanSavingsGoal(scanner interface {
	Scan(dest ...interface{}) error
}) (dto.SavingsGoal, error) {
	var (
		goal       dto.SavingsGoal
		targetDate sql.NullTime
		accountID  sql.NullString
		createdAt  time.Time
		updatedAt  time.Time
	)

	err := scanner.Scan(
		&goal.ID,
		&goal.Name,
		&goal.TargetAmount,
		&goal.CurrentSaved,
		&targetDate,
		&accountID,
		&goal.Status,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return dto.SavingsGoal{}, err
	}

	goal.ProgressPct = 0
	if goal.TargetAmount > 0 {
		goal.ProgressPct = math.Min((goal.CurrentSaved/goal.TargetAmount)*100, 100)
	}
	if targetDate.Valid {
		goal.TargetDate = targetDate.Time.Format("2006-01-02")
	}
	if accountID.Valid {
		goal.AccountID = accountID.String
	}
	goal.CreatedAt = createdAt.Format(time.RFC3339)
	goal.UpdatedAt = updatedAt.Format(time.RFC3339)

	return goal, nil
}

func (h *Handler) findSavingsGoalByID(ctx context.Context, userID string, goalID string) (dto.SavingsGoal, error) {
	row := h.db.QueryRowContext(
		ctx,
		`SELECT id, name, target_amount, current_saved, target_date, account_id, status, created_at, updated_at
		 FROM savings_goals
		 WHERE id = $1 AND user_id = $2`,
		goalID,
		userID,
	)

	return scanSavingsGoal(row)
}
