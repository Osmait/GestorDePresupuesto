ALTER TABLE certificate_payments ADD COLUMN updated_at TIMESTAMPTZ;
UPDATE certificate_payments SET updated_at = created_at WHERE updated_at IS NULL;
