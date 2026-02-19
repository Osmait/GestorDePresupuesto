CREATE TYPE interest_type AS ENUM ('simple', 'compound');
CREATE TYPE certificate_status AS ENUM ('active', 'matured', 'cancelled');

CREATE TABLE certificates (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    bank VARCHAR(255) NOT NULL,
    base_capital DECIMAL(15,2) NOT NULL,
    interest_type interest_type NOT NULL DEFAULT 'simple',
    current_interest_rate DECIMAL(5,2) NOT NULL,
    current_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    cut_day INTEGER NOT NULL CHECK (cut_day >= 1 AND cut_day <= 28),
    reinvest_interest BOOLEAN DEFAULT false,
    payout_account_id VARCHAR(32),
    maturity_date TIMESTAMPTZ,
    status certificate_status NOT NULL DEFAULT 'active',
    currency VARCHAR(3) NOT NULL DEFAULT 'DOP',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (payout_account_id) REFERENCES account(id) ON DELETE SET NULL
);

CREATE INDEX idx_certificates_user ON certificates(user_id);
CREATE INDEX idx_certificates_status ON certificates(status);

CREATE TABLE certificate_payments (
    id VARCHAR(32) PRIMARY KEY,
    certificate_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    gross_interest DECIMAL(15,2) NOT NULL,
    tax_withheld DECIMAL(15,2) NOT NULL,
    net_interest DECIMAL(15,2) NOT NULL,
    applied_rate DECIMAL(5,2) NOT NULL,
    applied_tax_rate DECIMAL(5,2) NOT NULL,
    applied_capital DECIMAL(15,2) NOT NULL,
    payout_account_id VARCHAR(32),
    transaction_id VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (payout_account_id) REFERENCES account(id) ON DELETE SET NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE INDEX idx_certificate_payments_cert ON certificate_payments(certificate_id);
CREATE INDEX idx_certificate_payments_date ON certificate_payments(certificate_id, payment_date);
CREATE INDEX idx_certificate_payments_user ON certificate_payments(user_id);
