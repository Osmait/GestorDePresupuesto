package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
)

// PasskeyRepositoryInterface defines the persistence contract for passkey records.
type PasskeyRepositoryInterface interface {
	Save(ctx context.Context, pk *passkey.Passkey) error
	FindByCredentialId(ctx context.Context, credentialId []byte) (*passkey.Passkey, error)
	FindByUserId(ctx context.Context, userId string) ([]*passkey.Passkey, error)
	UpdateSignCount(ctx context.Context, id string, signCount uint32) error
	Delete(ctx context.Context, id string, userId string) error
}
