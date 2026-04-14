package dto

import (
	"time"

	passkeyDomain "github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
	svc "github.com/osmait/gestorDePresupuesto/internal/services/passkey"
)

// FinishRegistrationRequest is the JSON wrapper around the browser attestation.
// The client sends { session_id, name, attestation_response } where the last
// field is the raw AuthenticatorAttestationResponse coming from
// navigator.credentials.create().
type FinishRegistrationRequest struct {
	SessionId           string `json:"session_id" binding:"required"`
	Name                string `json:"name"`
	AttestationResponse any    `json:"attestation_response" binding:"required"`
}

// FinishLoginRequest is the JSON wrapper around the browser assertion.
type FinishLoginRequest struct {
	SessionId         string `json:"session_id" binding:"required"`
	AssertionResponse any    `json:"assertion_response" binding:"required"`
}

// PasskeyResponse is the public representation of a passkey row.
type PasskeyResponse struct {
	Id           string     `json:"id"`
	Name         string     `json:"name"`
	CredentialId string     `json:"credential_id"`
	Transports   []string   `json:"transports"`
	CreatedAt    time.Time  `json:"created_at"`
	LastUsedAt   *time.Time `json:"last_used_at,omitempty"`
}

func NewPasskeyResponse(pk *passkeyDomain.Passkey) *PasskeyResponse {
	return &PasskeyResponse{
		Id:           pk.Id,
		Name:         pk.Name,
		CredentialId: svc.EncodeCredentialId(pk.CredentialId),
		Transports:   pk.Transports,
		CreatedAt:    pk.CreatedAt,
		LastUsedAt:   pk.LastUsedAt,
	}
}

// LoginResponse is what we return after a successful passkey assertion.
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}
