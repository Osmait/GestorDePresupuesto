package dto

type ExtractRequest struct {
	AccountID    string `json:"account_id" binding:"required"`
	DocumentType string `json:"document_type" binding:"required,oneof=receipt statement invoice"`
	Files        []struct {
		Filename    string `json:"filename" binding:"required"`
		ContentType string `json:"content_type" binding:"required"`
		Base64Data  string `json:"base64_data" binding:"required"`
	} `json:"files" binding:"required,min=1,max=5,dive"`
}

func (r *ExtractRequest) Validate() error {
	return nil
}
