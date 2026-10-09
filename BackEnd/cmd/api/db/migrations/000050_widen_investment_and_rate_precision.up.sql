-- Widen the columns that hold quantities, unit prices and exchange rates.
-- Migration 000036 sized them like money (scale 4/6/8), which is too narrow
-- for real investment data now that the Go side is exact decimal:
--   * quantity DECIMAL(18,8): ERC-20 tokens use up to 18 decimals and meme
--     coins are held in the tens of billions (the column caps at
--     9,999,999,999.99999999).
--   * purchase_price / current_price DECIMAL(19,4): sub-cent crypto prices
--     (e.g. 0.00001234 USD) round to 0.0000.
--   * exchange_rate DECIMAL(18,6) / DECIMAL(15,6): inverse rates such as
--     DOP->USD (0.016949...) keep only 4-5 significant digits.
-- Widening NUMERIC precision/scale never loses data, so no USING is needed.

ALTER TABLE investments
    ALTER COLUMN quantity       TYPE NUMERIC(38,18),
    ALTER COLUMN purchase_price TYPE NUMERIC(28,10),
    ALTER COLUMN current_price  TYPE NUMERIC(28,10),
    ALTER COLUMN exchange_rate  TYPE NUMERIC(24,10);

ALTER TABLE investment_funding_movements
    ALTER COLUMN exchange_rate TYPE NUMERIC(24,10);

ALTER TABLE card_payments
    ALTER COLUMN exchange_rate TYPE NUMERIC(24,10);

-- cryptos is a legacy table without active code; widened for consistency.
ALTER TABLE cryptos
    ALTER COLUMN price         TYPE NUMERIC(28,10),
    ALTER COLUMN current_price TYPE NUMERIC(28,10),
    ALTER COLUMN quantity      TYPE NUMERIC(38,18);
