-- Normalize all transaction amounts to positive values.
-- After this migration, amounts are always positive (>= 0).
-- The type_transation column is the sole source of directional meaning.
UPDATE transactions
SET amount = ABS(amount)
WHERE amount < 0;
