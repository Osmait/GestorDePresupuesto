-- Intentionally a no-op.
--
-- 000051 widened account/user/transaction id columns from VARCHAR(27..50) to
-- unbounded VARCHAR. Shrinking them back would either fail or (with a USING
-- cast) silently truncate every id longer than the old limit, e.g. the 36-char
-- UUIDs of demo accounts stored in card_payments.from_account_id, breaking
-- the references. Keeping the wider type is backwards compatible with every
-- earlier migration and with the application code, so rolling back leaves the
-- columns as they are.
SELECT 1;
