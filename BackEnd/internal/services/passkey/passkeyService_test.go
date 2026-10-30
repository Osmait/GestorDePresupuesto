package passkey

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
	"github.com/go-webauthn/webauthn/webauthn"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	passkeyDomain "github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
	userDTO "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	passkeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/passkey"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testRPID   = "localhost"
	testOrigin = "http://localhost:3000"
	testUserID = "user-1"
)

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

type fakePasskeyRepo struct {
	mu          sync.Mutex
	passkeys    map[string]*passkeyDomain.Passkey // by id
	sessions    map[string]*passkeyRepo.WebAuthnSession
	updateCalls []updateCall
}

type updateCall struct {
	id        string
	signCount uint32
	credJSON  []byte
}

func newFakePasskeyRepo() *fakePasskeyRepo {
	return &fakePasskeyRepo{
		passkeys: map[string]*passkeyDomain.Passkey{},
		sessions: map[string]*passkeyRepo.WebAuthnSession{},
	}
}

func (f *fakePasskeyRepo) Save(_ context.Context, pk *passkeyDomain.Passkey) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.passkeys[pk.Id] = pk
	return nil
}

func (f *fakePasskeyRepo) FindByCredentialId(_ context.Context, credentialId []byte) (*passkeyDomain.Passkey, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, pk := range f.passkeys {
		if bytes.Equal(pk.CredentialId, credentialId) {
			return pk, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (f *fakePasskeyRepo) FindByUserId(_ context.Context, userId string) ([]*passkeyDomain.Passkey, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []*passkeyDomain.Passkey
	for _, pk := range f.passkeys {
		if pk.UserId == userId {
			out = append(out, pk)
		}
	}
	return out, nil
}

func (f *fakePasskeyRepo) UpdateSignCount(_ context.Context, id string, signCount uint32, credentialJSON []byte) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updateCalls = append(f.updateCalls, updateCall{id, signCount, credentialJSON})
	pk, ok := f.passkeys[id]
	if !ok {
		return sql.ErrNoRows
	}
	pk.SignCount = signCount
	if credentialJSON != nil {
		pk.CredentialJSON = credentialJSON
	}
	return nil
}

func (f *fakePasskeyRepo) Delete(_ context.Context, id, userId string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if pk, ok := f.passkeys[id]; ok && pk.UserId == userId {
		delete(f.passkeys, id)
		return nil
	}
	return sql.ErrNoRows
}

func (f *fakePasskeyRepo) SaveSession(_ context.Context, s *passkeyRepo.WebAuthnSession) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	cp := *s
	f.sessions[s.Id] = &cp
	return nil
}

func (f *fakePasskeyRepo) TakeSession(_ context.Context, id, kind string) (*passkeyRepo.WebAuthnSession, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.sessions[id]
	if !ok || s.Kind != kind {
		return nil, sql.ErrNoRows
	}
	delete(f.sessions, id)
	if !s.ExpiresAt.After(time.Now()) {
		return nil, sql.ErrNoRows
	}
	return s, nil
}

type fakeUserSvc struct{}

func (fakeUserSvc) FindUserById(_ context.Context, id string) (*userDTO.UserResponse, error) {
	if id != testUserID {
		return nil, errors.New("not found")
	}
	return &userDTO.UserResponse{Id: id, Name: "Ada", LastName: "Lovelace", Email: "ada@example.com"}, nil
}

type fakeAuthSvc struct{ issued []string }

func (f *fakeAuthSvc) IssueTokensForUser(_ context.Context, userId, _, _ string) (*authDomain.AuthResponse, error) {
	f.issued = append(f.issued, userId)
	return authDomain.NewAuthResponse("access-"+userId, "refresh-"+userId, 900), nil
}

// ---------------------------------------------------------------------------
// virtual authenticator
// ---------------------------------------------------------------------------

type virtualAuthenticator struct {
	key    *ecdsa.PrivateKey
	credID []byte
	// flags of the authenticator data: user present + user verified.
	flags byte
}

func newVirtualAuthenticator(t *testing.T) *virtualAuthenticator {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	return &virtualAuthenticator{key: key, credID: []byte("credential-id-0001"), flags: 0x01 | 0x04}
}

func (v *virtualAuthenticator) cosePublicKey(t *testing.T) []byte {
	t.Helper()
	ecdhKey, err := v.key.PublicKey.ECDH()
	require.NoError(t, err)
	raw := ecdhKey.Bytes() // 0x04 || X || Y
	cose, err := webauthncbor.Marshal(webauthncose.EC2PublicKeyData{
		PublicKeyData: webauthncose.PublicKeyData{
			KeyType:   int64(webauthncose.EllipticKey),
			Algorithm: int64(webauthncose.AlgES256),
		},
		Curve:  int64(webauthncose.P256),
		XCoord: raw[1:33],
		YCoord: raw[33:65],
	})
	require.NoError(t, err)
	return cose
}

// enroll stores a passkey whose stored sign counter is storedCount.
func (v *virtualAuthenticator) enroll(t *testing.T, repo *fakePasskeyRepo, storedCount uint32) *passkeyDomain.Passkey {
	t.Helper()
	cred := webauthn.Credential{
		ID:        v.credID,
		PublicKey: v.cosePublicKey(t),
		Flags:     webauthn.CredentialFlags{UserPresent: true, UserVerified: true},
		Authenticator: webauthn.Authenticator{
			SignCount: storedCount,
		},
	}
	credJSON, err := json.Marshal(cred)
	require.NoError(t, err)
	pk := &passkeyDomain.Passkey{
		Id:             "pk-1",
		UserId:         testUserID,
		CredentialId:   v.credID,
		PublicKey:      cred.PublicKey,
		SignCount:      storedCount,
		Name:           "Test key",
		CredentialJSON: credJSON,
		CreatedAt:      time.Now(),
	}
	require.NoError(t, repo.Save(context.Background(), pk))
	return pk
}

// assert builds the browser's assertion response for the given challenge,
// reporting the given signature counter.
func (v *virtualAuthenticator) assertion(t *testing.T, challenge string, counter uint32) *http.Request {
	t.Helper()
	b64 := base64.RawURLEncoding.EncodeToString

	rpIDHash := sha256.Sum256([]byte(testRPID))
	authData := make([]byte, 0, 37)
	authData = append(authData, rpIDHash[:]...)
	authData = append(authData, v.flags) // UP (+ UV unless a test clears it)
	ctr := make([]byte, 4)
	binary.BigEndian.PutUint32(ctr, counter)
	authData = append(authData, ctr...)

	clientData, err := json.Marshal(map[string]any{
		"type":        "webauthn.get",
		"challenge":   challenge,
		"origin":      testOrigin,
		"crossOrigin": false,
	})
	require.NoError(t, err)
	clientHash := sha256.Sum256(clientData)
	signed := sha256.Sum256(append(append([]byte{}, authData...), clientHash[:]...))
	sig, err := ecdsa.SignASN1(rand.Reader, v.key, signed[:])
	require.NoError(t, err)

	body, err := json.Marshal(map[string]any{
		"id":    b64(v.credID),
		"rawId": b64(v.credID),
		"type":  "public-key",
		"response": map[string]any{
			"authenticatorData": b64(authData),
			"clientDataJSON":    b64(clientData),
			"signature":         b64(sig),
			"userHandle":        b64([]byte(testUserID)),
		},
	})
	require.NoError(t, err)
	req, err := http.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func newTestService(t *testing.T, repo *fakePasskeyRepo, auth *fakeAuthSvc) *PasskeyService {
	t.Helper()
	wa, err := webauthn.New(&webauthn.Config{
		RPDisplayName: "Test",
		RPID:          testRPID,
		RPOrigins:     []string{testOrigin},
	})
	require.NoError(t, err)
	return NewPasskeyService(wa, repo, fakeUserSvc{}, auth, time.Minute)
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

func TestFinishLogin_SignCounterAndCloneWarning(t *testing.T) {
	tests := []struct {
		name        string
		stored      uint32
		reported    uint32
		wantErr     error
		wantUpdated uint32
	}{
		{name: "counter advances: login ok", stored: 10, reported: 11, wantUpdated: 11},
		{name: "counter not in use (0/0): login ok", stored: 0, reported: 0, wantUpdated: 0},
		{name: "counter replayed: clone warning rejects", stored: 10, reported: 10, wantErr: ErrClonedAuthenticator},
		{name: "counter went backwards: clone warning rejects", stored: 10, reported: 5, wantErr: ErrClonedAuthenticator},
		{name: "counter reset to 0: clone warning rejects", stored: 10, reported: 0, wantErr: ErrClonedAuthenticator},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := newFakePasskeyRepo()
			auth := &fakeAuthSvc{}
			svc := newTestService(t, repo, auth)
			va := newVirtualAuthenticator(t)
			va.enroll(t, repo, tc.stored)

			begin, err := svc.BeginLogin(context.Background())
			require.NoError(t, err)

			tokens, pk, err := svc.FinishLogin(context.Background(), begin.SessionID,
				va.assertion(t, begin.Options.Response.Challenge.String(), tc.reported), "ua", "ip")

			if tc.wantErr != nil {
				assert.ErrorIs(t, err, tc.wantErr)
				assert.Nil(t, tokens)
				assert.Nil(t, pk)
				assert.Empty(t, auth.issued, "no tokens for a cloned authenticator")
				assert.Empty(t, repo.updateCalls, "nothing persisted on clone warning")
				return
			}

			require.NoError(t, err)
			assert.Equal(t, "access-"+testUserID, tokens.AccessToken)
			require.Len(t, repo.updateCalls, 1)
			call := repo.updateCalls[0]
			assert.Equal(t, tc.wantUpdated, call.signCount)

			// credential_json is updated in the same call and carries the
			// same counter (it is what the next login reads back).
			var cred webauthn.Credential
			require.NoError(t, json.Unmarshal(call.credJSON, &cred))
			assert.Equal(t, tc.wantUpdated, cred.Authenticator.SignCount)
			assert.False(t, cred.Authenticator.CloneWarning)
		})
	}
}

func TestFinishLogin_SequentialLoginsUseUpdatedCredentialJSON(t *testing.T) {
	repo := newFakePasskeyRepo()
	svc := newTestService(t, repo, &fakeAuthSvc{})
	va := newVirtualAuthenticator(t)
	va.enroll(t, repo, 1)

	for _, counter := range []uint32{2, 3, 4} {
		begin, err := svc.BeginLogin(context.Background())
		require.NoError(t, err)
		_, _, err = svc.FinishLogin(context.Background(), begin.SessionID,
			va.assertion(t, begin.Options.Response.Challenge.String(), counter), "ua", "ip")
		require.NoError(t, err, "counter %d", counter)
	}

	// Replaying an old counter is now detected thanks to the synced JSON.
	begin, err := svc.BeginLogin(context.Background())
	require.NoError(t, err)
	_, _, err = svc.FinishLogin(context.Background(), begin.SessionID,
		va.assertion(t, begin.Options.Response.Challenge.String(), 3), "ua", "ip")
	assert.ErrorIs(t, err, ErrClonedAuthenticator)
}

func TestFinishLogin_SessionIsSingleUse(t *testing.T) {
	repo := newFakePasskeyRepo()
	svc := newTestService(t, repo, &fakeAuthSvc{})
	va := newVirtualAuthenticator(t)
	va.enroll(t, repo, 1)

	begin, err := svc.BeginLogin(context.Background())
	require.NoError(t, err)
	challenge := begin.Options.Response.Challenge.String()

	_, _, err = svc.FinishLogin(context.Background(), begin.SessionID, va.assertion(t, challenge, 2), "ua", "ip")
	require.NoError(t, err)

	_, _, err = svc.FinishLogin(context.Background(), begin.SessionID, va.assertion(t, challenge, 3), "ua", "ip")
	assert.ErrorIs(t, err, errSessionNotFound)

	_, _, err = svc.FinishLogin(context.Background(), "", va.assertion(t, challenge, 3), "ua", "ip")
	assert.ErrorIs(t, err, errSessionNotFound)
}

func TestSessions_KindAndExpiry(t *testing.T) {
	repo := newFakePasskeyRepo()
	svc := newTestService(t, repo, &fakeAuthSvc{})

	reg, err := svc.BeginRegistration(context.Background(), testUserID)
	require.NoError(t, err)
	require.Contains(t, repo.sessions, reg.SessionID)
	assert.Equal(t, testUserID, repo.sessions[reg.SessionID].UserId)
	assert.WithinDuration(t, time.Now().Add(time.Minute), repo.sessions[reg.SessionID].ExpiresAt, 5*time.Second)

	// A registration session cannot be used for login.
	_, _, err = svc.FinishLogin(context.Background(), reg.SessionID, &http.Request{}, "ua", "ip")
	assert.ErrorIs(t, err, errSessionNotFound)

	// Registration session bound to its user.
	reg2, err := svc.BeginRegistration(context.Background(), testUserID)
	require.NoError(t, err)
	_, err = svc.FinishRegistration(context.Background(), "someone-else", reg2.SessionID, "", &http.Request{})
	assert.Error(t, err)

	// Expired session.
	reg3, err := svc.BeginRegistration(context.Background(), testUserID)
	require.NoError(t, err)
	repo.sessions[reg3.SessionID].ExpiresAt = time.Now().Add(-time.Second)
	_, err = svc.FinishRegistration(context.Background(), testUserID, reg3.SessionID, "", &http.Request{})
	assert.ErrorIs(t, err, errSessionNotFound)
}

func TestManagementAndHelpers(t *testing.T) {
	repo := newFakePasskeyRepo()
	svc := newTestService(t, repo, &fakeAuthSvc{})
	va := newVirtualAuthenticator(t)
	pk := va.enroll(t, repo, 0)

	list, err := svc.ListForUser(context.Background(), testUserID)
	require.NoError(t, err)
	assert.Len(t, list, 1)

	assert.Error(t, svc.DeleteForUser(context.Background(), pk.Id, "intruder"))
	assert.NoError(t, svc.DeleteForUser(context.Background(), pk.Id, testUserID))

	assert.Equal(t, "AQID", EncodeCredentialId([]byte{1, 2, 3}))

	// Fallback path for rows without credential_json.
	legacy := &passkeyDomain.Passkey{CredentialId: []byte("c"), PublicKey: []byte("k"), SignCount: 4, Transports: []string{"usb"}}
	cred := toWebAuthnCredential(legacy)
	assert.Equal(t, uint32(4), cred.Authenticator.SignCount)
	assert.Len(t, cred.Transport, 1)
}

// A passkey login needs user verification (PIN, biometrics): an authenticator
// that only proves presence (a bare security key touch) is rejected.
func TestFinishLogin_RequiresUserVerification(t *testing.T) {
	repo := newFakePasskeyRepo()
	auth := &fakeAuthSvc{}
	svc := newTestService(t, repo, auth)
	va := newVirtualAuthenticator(t)
	va.enroll(t, repo, 1)
	va.flags = 0x01 // user present only

	begin, err := svc.BeginLogin(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "required", string(begin.Options.Response.UserVerification))

	tokens, _, err := svc.FinishLogin(context.Background(), begin.SessionID,
		va.assertion(t, begin.Options.Response.Challenge.String(), 2), "ua", "ip")
	assert.Error(t, err)
	assert.Nil(t, tokens)
	assert.Empty(t, auth.issued)
}

func TestBeginRegistration_RequiresUserVerification(t *testing.T) {
	repo := newFakePasskeyRepo()
	svc := newTestService(t, repo, &fakeAuthSvc{})
	begin, err := svc.BeginRegistration(context.Background(), testUserID)
	require.NoError(t, err)
	require.NotNil(t, begin.Options.Response.AuthenticatorSelection.UserVerification)
	assert.Equal(t, "required", string(begin.Options.Response.AuthenticatorSelection.UserVerification))
}
