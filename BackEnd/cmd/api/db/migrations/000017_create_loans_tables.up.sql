CREATE TYPE loan_interest_mode AS ENUM ('fixed_total', 'none');
CREATE TYPE loan_status AS ENUM ('active', 'paid', 'defaulted', 'cancelled');
CREATE TYPE loan_installment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');

CREATE TABLE loans (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    borrower_name VARCHAR(120) NOT NULL,
    borrower_contact VARCHAR(120),
    principal_amount DECIMAL(15,2) NOT NULL CHECK (principal_amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'DOP',
    interest_mode loan_interest_mode NOT NULL,
    annual_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
    term_months INTEGER NOT NULL CHECK (term_months >= 1 AND term_months <= 120),
    start_date DATE NOT NULL,
    source_account_id VARCHAR(32) NOT NULL,
    notes TEXT,
    total_interest DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_principal DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_interest DECIMAL(15,2) NOT NULL DEFAULT 0,
    status loan_status NOT NULL DEFAULT 'active',
    disbursement_transaction_id VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (source_account_id) REFERENCES account(id) ON DELETE RESTRICT
);

CREATE INDEX idx_loans_user_status ON loans(user_id, status);
CREATE INDEX idx_loans_created_at ON loans(created_at DESC);

CREATE TABLE loan_installments (
    id VARCHAR(32) PRIMARY KEY,
    loan_id VARCHAR(32) NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    expected_amount DECIMAL(15,2) NOT NULL CHECK (expected_amount > 0),
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status loan_installment_status NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    UNIQUE(loan_id, installment_number)
);

CREATE INDEX idx_loan_installments_due_date ON loan_installments(loan_id, due_date);
CREATE INDEX idx_loan_installments_status ON loan_installments(status);

CREATE TABLE loan_payments (
    id VARCHAR(32) PRIMARY KEY,
    loan_id VARCHAR(32) NOT NULL,
    destination_account_id VARCHAR(32) NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    principal_component DECIMAL(15,2) NOT NULL DEFAULT 0,
    interest_component DECIMAL(15,2) NOT NULL DEFAULT 0,
    payment_date TIMESTAMPTZ NOT NULL,
    income_transaction_id VARCHAR,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    FOREIGN KEY (destination_account_id) REFERENCES account(id) ON DELETE RESTRICT
);

CREATE INDEX idx_loan_payments_loan_date ON loan_payments(loan_id, payment_date DESC);
