DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction'
        AND e.enumlabel = 'loan_cancellation_refund'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'loan_cancellation_refund';
    END IF;
END $$;
