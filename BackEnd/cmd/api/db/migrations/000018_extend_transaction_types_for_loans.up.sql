DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction' AND e.enumlabel = 'loan_disbursement'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'loan_disbursement';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction' AND e.enumlabel = 'loan_collection'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'loan_collection';
    END IF;
END
$$;
