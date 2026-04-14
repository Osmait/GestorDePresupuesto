CREATE TABLE card_balance_resets (
    id VARCHAR(32) PRIMARY KEY,
    balance_id VARCHAR(32) NOT NULL,
    card_id VARCHAR(32) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    previous_balance DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (balance_id) REFERENCES card_balances(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES credit_cards(account_id) ON DELETE CASCADE
);

CREATE INDEX idx_card_balance_resets_card ON card_balance_resets(card_id);
CREATE INDEX idx_card_balance_resets_balance ON card_balance_resets(balance_id);
CREATE INDEX idx_card_balance_resets_created_at ON card_balance_resets(created_at);

ALTER TABLE card_balance_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_balance_resets FORCE ROW LEVEL SECURITY;
CREATE POLICY card_balance_resets_isolation ON card_balance_resets
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_balance_resets.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));
