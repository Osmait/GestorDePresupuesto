-- Convert float/double precision monetary columns to DECIMAL for exact financial storage.
-- The USING clause is required when casting from float8 to NUMERIC in PostgreSQL.
-- Existing values are preserved; floating-point noise in trailing digits will be
-- rounded to the column's scale on cast (which is the intended fix).

-- account.balance
ALTER TABLE account
    ALTER COLUMN balance TYPE DECIMAL(19,4) USING balance::DECIMAL(19,4);

-- transactions.amount
ALTER TABLE transactions
    ALTER COLUMN amount TYPE DECIMAL(19,4) USING amount::DECIMAL(19,4);

-- budgets.amount
ALTER TABLE budgets
    ALTER COLUMN amount TYPE DECIMAL(19,4) USING amount::DECIMAL(19,4);

-- investments core columns (migration 000003)
ALTER TABLE investments
    ALTER COLUMN quantity       TYPE DECIMAL(18,8) USING quantity::DECIMAL(18,8),
    ALTER COLUMN purchase_price TYPE DECIMAL(19,4) USING purchase_price::DECIMAL(19,4),
    ALTER COLUMN current_price  TYPE DECIMAL(19,4) USING current_price::DECIMAL(19,4);

-- investments extended columns (migration 000026)
ALTER TABLE investments
    ALTER COLUMN source_amount TYPE DECIMAL(19,4) USING source_amount::DECIMAL(19,4),
    ALTER COLUMN source_amount SET DEFAULT 0,
    ALTER COLUMN exchange_rate TYPE DECIMAL(18,6) USING exchange_rate::DECIMAL(18,6);

-- investment_funding_balances (migration 000027)
ALTER TABLE investment_funding_balances
    ALTER COLUMN available_amount TYPE DECIMAL(19,4) USING available_amount::DECIMAL(19,4),
    ALTER COLUMN available_amount SET DEFAULT 0;

-- investment_funding_movements (migration 000027)
ALTER TABLE investment_funding_movements
    ALTER COLUMN amount         TYPE DECIMAL(19,4) USING amount::DECIMAL(19,4),
    ALTER COLUMN counter_amount TYPE DECIMAL(19,4) USING counter_amount::DECIMAL(19,4),
    ALTER COLUMN exchange_rate  TYPE DECIMAL(18,6) USING exchange_rate::DECIMAL(18,6);

-- savings_goals (migration 000021)
ALTER TABLE savings_goals
    ALTER COLUMN target_amount TYPE DECIMAL(19,4) USING target_amount::DECIMAL(19,4),
    ALTER COLUMN current_saved TYPE DECIMAL(19,4) USING current_saved::DECIMAL(19,4),
    ALTER COLUMN current_saved SET DEFAULT 0;

-- cryptos (legacy table, no active code — included for schema consistency)
ALTER TABLE cryptos
    ALTER COLUMN price         TYPE DECIMAL(18,8) USING price::DECIMAL(18,8),
    ALTER COLUMN current_price TYPE DECIMAL(18,8) USING current_price::DECIMAL(18,8),
    ALTER COLUMN quantity      TYPE DECIMAL(18,8) USING quantity::DECIMAL(18,8);
