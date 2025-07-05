package middleware

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// ValidationMiddleware provides comprehensive input validation for all API endpoints.
// It implements custom validators for security and business rule compliance.
type ValidationMiddleware struct {
	validator *validator.Validate
}

// NewValidationMiddleware creates a new validation middleware with custom validators.
func NewValidationMiddleware() *ValidationMiddleware {
	v := validator.New()

	// Register custom validators
	v.RegisterValidation("alpha_space", validateAlphaSpace)
	v.RegisterValidation("password_strength", validatePasswordStrength)
	v.RegisterValidation("transaction_type", validateTransactionType)
	v.RegisterValidation("positive_amount", validatePositiveAmount)

	return &ValidationMiddleware{
		validator: v,
	}
}

// ValidateJSON middleware validates JSON request bodies against struct validation tags.
// It returns detailed error messages for validation failures.
func (vm *ValidationMiddleware) ValidateJSON() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip validation for GET requests and certain endpoints
		if c.Request.Method == "GET" || shouldSkipValidation(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Get the expected struct type from context (set by handler)
		expectedType := c.GetString("validation_struct")
		if expectedType == "" {
			c.Next()
			return
		}

		// Validate the request body
		if err := vm.validateRequestBody(c, expectedType); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "validation failed",
				"details": err.Error(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// validateRequestBody performs validation on the request body
func (vm *ValidationMiddleware) validateRequestBody(c *gin.Context, structType string) error {
	contentType := c.GetHeader("Content-Type")
	if !strings.Contains(contentType, "application/json") {
		return fmt.Errorf("content-type must be application/json")
	}

	// Create struct instance based on type
	var requestStruct interface{}
	switch structType {
	case "UserRequest":
		requestStruct = &struct {
			Name     string `json:"name" validate:"required,min=2,max=50,alpha_space"`
			LastName string `json:"last_name" validate:"required,min=2,max=50,alpha_space"`
			Password string `json:"password" validate:"required,min=8,max=128,password_strength"`
			Email    string `json:"email" validate:"required,email,max=320"`
		}{}
	case "AccountRequest":
		requestStruct = &struct {
			Name           string  `json:"name" validate:"required,min=2,max=100,printascii"`
			Bank           string  `json:"bank" validate:"required,min=2,max=100,printascii"`
			InitialBalance float64 `json:"initial_balance" validate:"min=0,max=999999999.99"`
		}{}
	case "TransactionRequest":
		requestStruct = &struct {
			Name        string  `json:"name" validate:"required,min=1,max=200,printascii"`
			Description string  `json:"description" validate:"max=500"`
			Type        string  `json:"type" validate:"required,transaction_type"`
			Amount      float64 `json:"amount" validate:"required,positive_amount"`
			AccountId   string  `json:"account_id" validate:"required,min=1,max=100"`
			CategoryId  string  `json:"category_id" validate:"required,min=1,max=100"`
		}{}
	case "CategoryRequest":
		requestStruct = &struct {
			Name  string `json:"name" validate:"required,min=1,max=100,printascii"`
			Icon  string `json:"icon" validate:"required,min=1,max=50,printascii"`
			Color string `json:"color" validate:"required,min=1,max=50,printascii"`
		}{}
	case "BudgetRequest":
		requestStruct = &struct {
			CategoryId string  `json:"category_id" validate:"required,min=1,max=100"`
			Amount     float64 `json:"amount" validate:"required,positive_amount"`
		}{}
	default:
		// Skip validation for unknown types
		return nil
	}

	// Bind JSON to struct
	if err := c.ShouldBindJSON(requestStruct); err != nil {
		return fmt.Errorf("invalid JSON format: %w", err)
	}

	// Validate struct
	if err := vm.validator.Struct(requestStruct); err != nil {
		return vm.formatValidationError(err)
	}

	return nil
}

// formatValidationError converts validator errors to user-friendly messages
func (vm *ValidationMiddleware) formatValidationError(err error) error {
	var errorMessages []string

	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			errorMessages = append(errorMessages, vm.formatFieldError(e))
		}
	}

	if len(errorMessages) == 0 {
		return fmt.Errorf("validation failed: %w", err)
	}

	return fmt.Errorf("validation errors: %s", strings.Join(errorMessages, "; "))
}

// formatFieldError formats individual field validation errors
func (vm *ValidationMiddleware) formatFieldError(e validator.FieldError) string {
	field := strings.ToLower(e.Field())

	switch e.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters", field, e.Param())
	case "max":
		return fmt.Sprintf("%s must not exceed %s characters", field, e.Param())
	case "email":
		return fmt.Sprintf("%s must be a valid email address", field)
	case "alpha_space":
		return fmt.Sprintf("%s must contain only letters and spaces", field)
	case "password_strength":
		return fmt.Sprintf("%s must contain at least one uppercase, one lowercase, one number, and one special character", field)
	case "transaction_type":
		return fmt.Sprintf("%s must be either 'income' or 'bill'", field)
	case "positive_amount":
		return fmt.Sprintf("%s must be a positive number", field)
	case "printascii":
		return fmt.Sprintf("%s must contain only printable ASCII characters", field)
	default:
		return fmt.Sprintf("%s failed validation: %s", field, e.Tag())
	}
}

// Custom validator: alpha_space - allows only letters and spaces
func validateAlphaSpace(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	for _, char := range value {
		if !unicode.IsLetter(char) && char != ' ' {
			return false
		}
	}
	return true
}

// Custom validator: password_strength - enforces strong password requirements
func validatePasswordStrength(fl validator.FieldLevel) bool {
	password := fl.Field().String()

	if len(password) < 8 {
		return false
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsNumber(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	return hasUpper && hasLower && hasNumber && hasSpecial
}

// Custom validator: transaction_type - validates transaction types
func validateTransactionType(fl validator.FieldLevel) bool {
	txType := fl.Field().String()
	return txType == "income" || txType == "bill"
}

// Custom validator: positive_amount - ensures positive financial amounts
func validatePositiveAmount(fl validator.FieldLevel) bool {
	amount := fl.Field().Float()
	return amount > 0
}

// shouldSkipValidation determines if validation should be skipped for certain endpoints
func shouldSkipValidation(path string) bool {
	skipPaths := []string{
		"/health",
		"/ping",
		"/metrics",
		"/profile",
	}

	for _, skipPath := range skipPaths {
		if strings.Contains(path, skipPath) {
			return true
		}
	}

	// Skip validation for GET endpoints that don't have request bodies
	return false
}

// SetValidationStruct sets the expected struct type for validation
func SetValidationStruct(structType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("validation_struct", structType)
		c.Next()
	}
}

// SanitizeInput middleware sanitizes input to prevent injection attacks
func SanitizeInput() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Sanitize headers
		sanitizeHeaders(c)

		// Continue processing
		c.Next()
	}
}

// sanitizeHeaders removes potentially dangerous characters from headers
func sanitizeHeaders(c *gin.Context) {
	dangerousChars := regexp.MustCompile(`[<>&"']`)

	for header, values := range c.Request.Header {
		for i, value := range values {
			c.Request.Header[header][i] = dangerousChars.ReplaceAllString(value, "")
		}
	}
}

// ValidateJWT validates JWT token format (basic format check)
func ValidateJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		// Basic JWT format validation
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid authorization header format",
			})
			c.Abort()
			return
		}

		// Basic JWT structure check (3 parts separated by dots)
		tokenParts := strings.Split(parts[1], ".")
		if len(tokenParts) != 3 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid JWT token format",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
