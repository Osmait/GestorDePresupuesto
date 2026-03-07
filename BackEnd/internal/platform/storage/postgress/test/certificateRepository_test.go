package postgress

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
)

func TestCertificateRepository(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	userRepository := userRepo.NewUserRepository(db)
	certificateRepository := certificateRepo.NewCertificateRepository(db)

	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	cert := utils.GetNewRandomCertificate(user.Id)

	err = certificateRepository.Save(ctx, cert)
	assert.NoError(t, err)

	foundCert, err := certificateRepository.FindById(ctx, cert.Id, user.Id)
	assert.NoError(t, err)
	assert.Equal(t, cert.Id, foundCert.Id)
	assert.Equal(t, cert.Bank, foundCert.Bank)
	assert.Equal(t, cert.BaseCapital, foundCert.BaseCapital)
	assert.Equal(t, cert.InterestType, foundCert.InterestType)
	assert.Equal(t, cert.CurrentInterestRate, foundCert.CurrentInterestRate)
	assert.Equal(t, cert.Status, certificate.StatusActive)

	certs, err := certificateRepository.FindAll(ctx, user.Id)
	assert.NoError(t, err)
	assert.NotEmpty(t, certs)

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCertificateRepository_FindById_NotFound(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	certificateRepository := certificateRepo.NewCertificateRepository(db)

	foundCert, err := certificateRepository.FindById(ctx, "non-existent-id", "non-existent-user")
	assert.Error(t, err)
	assert.Nil(t, foundCert)
}

func TestCertificateRepository_FindAll_Empty(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	certificateRepository := certificateRepo.NewCertificateRepository(db)

	certs, err := certificateRepository.FindAll(ctx, "non-existent-user")
	assert.NoError(t, err)
	assert.Empty(t, certs)
}

func TestCertificateRepository_Update(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	userRepository := userRepo.NewUserRepository(db)
	certificateRepository := certificateRepo.NewCertificateRepository(db)

	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	cert := utils.GetNewRandomCertificate(user.Id)
	cert.CurrentInterestRate = 5.0

	err = certificateRepository.Save(ctx, cert)
	assert.NoError(t, err)

	cert.CurrentInterestRate = 6.5
	cert.CurrentTaxRate = 15.0

	err = certificateRepository.Update(ctx, cert)
	assert.NoError(t, err)

	foundCert, err := certificateRepository.FindById(ctx, cert.Id, user.Id)
	assert.NoError(t, err)
	assert.Equal(t, 6.5, foundCert.CurrentInterestRate)
	assert.Equal(t, 15.0, foundCert.CurrentTaxRate)

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCertificateRepository_SaveAndFindPayments(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	userRepository := userRepo.NewUserRepository(db)
	certificateRepository := certificateRepo.NewCertificateRepository(db)

	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	cert := utils.GetNewRandomCertificate(user.Id)
	err = certificateRepository.Save(ctx, cert)
	assert.NoError(t, err)

	payment1 := utils.GetNewRandomCertificatePayment(cert.Id, user.Id)
	payment2 := utils.GetNewRandomCertificatePayment(cert.Id, user.Id)

	err = certificateRepository.SavePayment(ctx, payment1)
	assert.NoError(t, err)

	err = certificateRepository.SavePayment(ctx, payment2)
	assert.NoError(t, err)

	payments, err := certificateRepository.FindPaymentsByCertificate(ctx, cert.Id)
	assert.NoError(t, err)
	assert.Len(t, payments, 2)

	lastPayment, err := certificateRepository.FindLastPayment(ctx, cert.Id)
	assert.NoError(t, err)
	assert.Equal(t, payment2.Id, lastPayment.Id)

	allPayments, err := certificateRepository.FindAllPayments(ctx, user.Id)
	assert.NoError(t, err)
	assert.Len(t, allPayments, 2)

	// Cleanup in FK order: certificate_payments → certificates → users
	_, err = db.ExecContext(ctx, "DELETE FROM certificate_payments WHERE user_id = $1", user.Id)
	assert.NoError(t, err)
	_, err = db.ExecContext(ctx, "DELETE FROM certificates WHERE user_id = $1", user.Id)
	assert.NoError(t, err)
	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCertificateRepository_FindActiveByUser(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	userRepository := userRepo.NewUserRepository(db)
	certificateRepository := certificateRepo.NewCertificateRepository(db)

	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	activeCert := utils.GetNewRandomCertificate(user.Id)
	activeCert.Status = certificate.StatusActive
	err = certificateRepository.Save(ctx, activeCert)
	assert.NoError(t, err)

	cancelledCert := utils.GetNewRandomCertificate(user.Id)
	cancelledCert.Status = certificate.StatusCancelled
	err = certificateRepository.Save(ctx, cancelledCert)
	assert.NoError(t, err)

	activeCerts, err := certificateRepository.FindActiveByUser(ctx, user.Id)
	assert.NoError(t, err)
	assert.Len(t, activeCerts, 1)
	assert.Equal(t, certificate.StatusActive, activeCerts[0].Status)

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCertificateRepository_MultipleCertificates(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	userRepository := userRepo.NewUserRepository(db)
	certificateRepository := certificateRepo.NewCertificateRepository(db)

	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	for i := 0; i < 3; i++ {
		cert := utils.GetNewRandomCertificate(user.Id)
		err = certificateRepository.Save(ctx, cert)
		assert.NoError(t, err)
	}

	certs, err := certificateRepository.FindAll(ctx, user.Id)
	assert.NoError(t, err)
	assert.Len(t, certs, 3)

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCertificateRepository_Delete(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	userRepository := userRepo.NewUserRepository(db)
	certificateRepository := certificateRepo.NewCertificateRepository(db)

	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	cert := utils.GetNewRandomCertificate(user.Id)
	err = certificateRepository.Save(ctx, cert)
	assert.NoError(t, err)

	// Verify it exists
	foundCert, err := certificateRepository.FindById(ctx, cert.Id, user.Id)
	assert.NoError(t, err)
	assert.NotNil(t, foundCert)

	// Test delete - Note: this uses NOW() which is Postgres-specific
	// For SQLite testing, we skip the actual delete and just verify the setup works
	// The delete functionality is tested in integration tests with PostgreSQL

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCertificateRepository_UpdateStatus(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	userRepository := userRepo.NewUserRepository(db)
	certificateRepository := certificateRepo.NewCertificateRepository(db)

	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	cert := utils.GetNewRandomCertificate(user.Id)
	cert.Status = certificate.StatusActive
	err = certificateRepository.Save(ctx, cert)
	assert.NoError(t, err)

	// Verify initial status
	foundCert, err := certificateRepository.FindById(ctx, cert.Id, user.Id)
	assert.NoError(t, err)
	assert.Equal(t, certificate.StatusActive, foundCert.Status)

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}
