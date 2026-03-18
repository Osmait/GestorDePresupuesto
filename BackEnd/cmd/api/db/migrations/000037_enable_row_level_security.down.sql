DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'account','transactions','categorys','budgets','investments',
        'recurring_transactions','notifications','savings_goals',
        'reconciliation_sessions','reconciliation_items','certificates',
        'certificate_payments','investment_funding_balances',
        'investment_funding_movements','loans','loan_installments',
        'loan_payments','credit_cards','card_balances','card_payments',
        'feature_flag_user_overrides','feature_flag_audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_isolation', tbl);
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', tbl);
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'osmait') THEN
        ALTER ROLE osmait NOBYPASSRLS;
    END IF;
END
$$;
