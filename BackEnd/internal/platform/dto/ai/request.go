package dto

type ExtractRequest struct {
	AccountID       string `json:"account_id" binding:"required"`
	AccountCurrency string `json:"account_currency"`
	DocumentType    string `json:"document_type" binding:"required,oneof=receipt statement invoice"`
	Language        string `json:"language"`
	Files           []struct {
		Filename    string `json:"filename" binding:"required"`
		ContentType string `json:"content_type" binding:"required"`
		Base64Data  string `json:"base64_data" binding:"required"`
	} `json:"files" binding:"required,min=1,max=5,dive"`
}

func (r *ExtractRequest) Validate() error {
	return nil
}

type AnalyzeSpendingRequest struct {
	DateFrom string `json:"date_from" binding:"required"`
	DateTo   string `json:"date_to" binding:"required"`
	Language string `json:"language"`
}

func (r *AnalyzeSpendingRequest) Validate() error {
	return nil
}
