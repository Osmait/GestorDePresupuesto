ALTER TABLE account ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'bank';
ALTER TABLE account ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'DOP';

CREATE TYPE card_payment_status AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE credit_cards (
    account_id VARCHAR(32) PRIMARY KEY,
    bank VARCHAR(255) NOT NULL,
    last_four_digits VARCHAR(4),
    cut_day INTEGER NOT NULL CHECK (cut_day >= 1 AND cut_day <= 28),
    due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 28),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (account_id) REFERENCES account(id) ON DELETE CASCADE
);

CREATE INDEX idx_credit_cards_bank ON credit_cards(bank);

CREATE TABLE card_balances (
    id VARCHAR(32) PRIMARY KEY,
    card_id VARCHAR(32) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit_limit DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (card_id) REFERENCES credit_cards(account_id) ON DELETE CASCADE,
    UNIQUE(card_id, currency)
);

CREATE INDEX idx_card_balances_card ON card_balances(card_id);
CREATE INDEX idx_card_balances_currency ON card_balances(card_id, currency);

CREATE TABLE card_payments (
    id VARCHAR(32) PRIMARY KEY,
    card_id VARCHAR(32) NOT NULL,
    from_account_id VARCHAR(32) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    includes_interest BOOLEAN DEFAULT false,
    interest_amount DECIMAL(15,2) DEFAULT 0,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status card_payment_status NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (card_id) REFERENCES credit_cards(account_id) ON DELETE CASCADE,
    FOREIGN KEY (from_account_id) REFERENCES account(id) ON DELETE CASCADE
);

CREATE INDEX idx_card_payments_card ON card_payments(card_id);
CREATE INDEX idx_card_payments_date ON card_payments(payment_date);
CREATE INDEX idx_card_payments_status ON card_payments(status);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) NOT NULL DEFAULT 'bill';
UPDATE transactions SET transaction_type = type_transation WHERE transaction_type = 'bill' OR transaction_type IS NULL;
