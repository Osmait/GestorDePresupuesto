DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction' AND e.enumlabel = 'card_payment'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'card_payment';
    END IF;
END$$;
