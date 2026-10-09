-- Restores the 000036/000015 column types. Values with more fractional digits
-- are rounded, and values outside the narrower ranges make this fail.

ALTER TABLE investments
    ALTER COLUMN quantity       TYPE DECIMAL(18,8) USING quantity::DECIMAL(18,8),
    ALTER COLUMN purchase_price TYPE DECIMAL(19,4) USING purchase_price::DECIMAL(19,4),
    ALTER COLUMN current_price  TYPE DECIMAL(19,4) USING current_price::DECIMAL(19,4),
    ALTER COLUMN exchange_rate  TYPE DECIMAL(18,6) USING exchange_rate::DECIMAL(18,6);

ALTER TABLE investment_funding_movements
    ALTER COLUMN exchange_rate TYPE DECIMAL(18,6) USING exchange_rate::DECIMAL(18,6);

ALTER TABLE card_payments
    ALTER COLUMN exchange_rate TYPE DECIMAL(15,6) USING exchange_rate::DECIMAL(15,6);

ALTER TABLE cryptos
    ALTER COLUMN price         TYPE DECIMAL(18,8) USING price::DECIMAL(18,8),
    ALTER COLUMN current_price TYPE DECIMAL(18,8) USING current_price::DECIMAL(18,8),
    ALTER COLUMN quantity      TYPE DECIMAL(18,8) USING quantity::DECIMAL(18,8);
